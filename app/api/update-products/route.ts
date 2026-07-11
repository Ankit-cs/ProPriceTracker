import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeAmazonProduct, cleanAmazonUrl } from "@/lib/amazon-scraper";
import { scrapeProduct } from "@/lib/firecrawl";

export async function GET() {
  try {
    // Create service role client to bypass RLS and perform database updates
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*");

    if (productsError) throw productsError;

    // Filter to only include Amazon products (non-Amazon are updated via Pricewatcha Webhooks)
    const amazonProducts = (products || []).filter(product => 
      product.url.includes("amazon.") || product.url.includes("amzn.")
    );

    console.log(`[Update API] Found ${amazonProducts.length} Amazon products to update`);

    const updated = [];
    const failed = [];

    for (const product of amazonProducts) {
      try {
        console.log(`[Update API] Scraping product: ${product.name} (${product.url})`);
        
        let productData;
        const isAmazon = product.url.includes("amazon.") || product.url.includes("amzn.");
        const cleanUrl = isAmazon ? cleanAmazonUrl(product.url) : product.url;
        if (isAmazon) {
          productData = await scrapeAmazonProduct(cleanUrl);
        } else {
          productData = await scrapeProduct(cleanUrl);
        }

        if (!productData) {
          failed.push({ id: product.id, name: product.name, error: "No data returned from scraper" });
          continue;
        }

        const updateData: any = {
          name: productData.productName || product.name,
          current_price: productData.currentPrice || product.current_price,
          currency: productData.currencyCode || productData.currency || product.currency,
          image_url: productData.productImageUrl || product.image_url,
          updated_at: new Date().toISOString(),
        };

        if (productData.amazonId !== undefined) {
          updateData.amazon_id = productData.amazonId;
          updateData.rating = productData.rating || 0;
          updateData.reviews_count = productData.reviewsCount || 0;
          updateData.short_description = productData.shortDescription || "";
          updateData.full_description = productData.fullDescription || "";
          updateData.is_amazon_choice = productData.isAmazonChoice || false;
          updateData.is_discounted = productData.isDiscounted || false;
          updateData.original_price = productData.originalPrice || 0;
        }

        const { error: updateError } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", product.id);

        if (updateError) throw updateError;
        
        // Also insert into price history if it doesn't have any history yet
        const { data: history } = await supabase
          .from("price_history")
          .select("id")
          .eq("product_id", product.id)
          .limit(1);

        if (!history || history.length === 0) {
          await supabase.from("price_history").insert({
            product_id: product.id,
            price: updateData.current_price,
            currency: updateData.currency,
          });
        }

        updated.push({ id: product.id, name: updateData.name });
      } catch (err: any) {
        console.error(`[Update API] Failed to update product ${product.id}:`, err.message);
        failed.push({ id: product.id, name: product.name, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Products updated successfully",
      updatedCount: updated.length,
      failedCount: failed.length,
      updated,
      failed
    });
  } catch (error: any) {
    console.error("[Update API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
