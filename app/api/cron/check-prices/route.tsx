import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeProduct } from "@/lib/firecrawl";
import { scrapeAmazonProduct } from "@/lib/amazon-scraper";
import { sendPriceDropAlert } from "@/lib/email";

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*");

    if (productsError) throw productsError;

    console.log(`Found ${products.length} products to check`);

    const results = {
      total: products.length,
      updated: 0,
      failed: 0,
      priceChanges: 0,
      alertsSent: 0,
    };

    for (const product of products) {
      try {
        let productData;
        if (product.url.includes("amazon.")) {
          productData = await scrapeAmazonProduct(product.url);
        } else {
          productData = await scrapeProduct(product.url);
        }

        if (!productData.currentPrice) {
          results.failed++;
          continue;
        }

        const newPrice = productData.currentPrice;
        const oldPrice = parseFloat(product.current_price);

        const updateData: any = {
            current_price: newPrice,
            currency: productData.currencyCode || product.currency,
            name: productData.productName || product.name,
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

        await supabase
          .from("products")
          .update(updateData)
          .eq("id", product.id);

        // Also, always insert into price history when cron runs to show the check happened today
        await supabase.from("price_history").insert({
          product_id: product.id,
          price: newPrice,
          currency: productData.currencyCode || productData.currency || product.currency,
        });

        if (oldPrice !== newPrice) {

          results.priceChanges++;

          if (newPrice < oldPrice) {
            const {
              data: { user },
            } = await supabase.auth.admin.getUserById(product.user_id);

            if (user?.email) {
              const emailResult = await sendPriceDropAlert(
                user.email,
                product,
                oldPrice,
                newPrice
              );

              if (emailResult.success) {
                results.alertsSent++;
              }
            }
          }
        }

        results.updated++;
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Price check completed",
      results,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Price check endpoint is working. Use POST to trigger.",
  });
}
