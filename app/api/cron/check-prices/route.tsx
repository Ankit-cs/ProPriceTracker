import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeProduct } from "@/lib/firecrawl";
import { scrapeAmazonProduct, cleanAmazonUrl } from "@/lib/amazon-scraper";
import { sendConsolidatedPriceDropAlert } from "@/lib/email";

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

    const userAlerts: Record<string, any[]> = {};
    const userBackInStockAlerts: Record<string, any[]> = {};

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      try {
        let productData;
        const isAmazon = product.url.includes("amazon.") || product.url.includes("amzn.");
        const cleanUrl = isAmazon ? cleanAmazonUrl(product.url) : product.url;
        
        if (isAmazon) {
          productData = await scrapeAmazonProduct(cleanUrl);
        } else {
          productData = await scrapeProduct(cleanUrl);
        }

        if (!productData.currentPrice) {
          results.failed++;
          continue;
        }

        const newPrice = productData.currentPrice;
        const oldPrice = parseFloat(product.current_price);
        const baselinePrice = parseFloat(product.last_notified_price || product.current_price);
        const targetDiscount = parseFloat(product.target_discount_percent || 0);

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
          updateData.is_in_stock = productData.isInStock !== undefined ? productData.isInStock : true;
        }

        if (newPrice !== oldPrice) {
          results.priceChanges++;
        }

        // Logic for back in stock alert
        if (product.is_in_stock === false && updateData.is_in_stock === true) {
           if (!userBackInStockAlerts[product.user_id]) {
              userBackInStockAlerts[product.user_id] = [];
           }
           userBackInStockAlerts[product.user_id].push({ ...product, ...updateData });
        }

        // Logic for alerting based on the threshold scale
        if (newPrice < baselinePrice && product.alerts_enabled) {
          const priceDrop = baselinePrice - newPrice;
          const percentageDrop = (priceDrop / baselinePrice) * 100;
          
          if (percentageDrop >= targetDiscount) {
             if (!userAlerts[product.user_id]) {
                userAlerts[product.user_id] = [];
             }
             userAlerts[product.user_id].push({
                product,
                oldPrice: baselinePrice,
                newPrice: newPrice,
                priceDrop: priceDrop,
                percentageDrop: percentageDrop.toFixed(1)
             });
             // reset baseline to current new price so they don't keep getting emailed until it drops another x%
             updateData.last_notified_price = newPrice;
          }
        }

        await supabase
          .from("products")
          .update(updateData)
          .eq("id", product.id);

        await supabase.from("price_history").insert({
          product_id: product.id,
          price: newPrice,
          currency: productData.currencyCode || productData.currency || product.currency,
        });

        results.updated++;
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
        results.failed++;
      }

      // Smart Delays: Wait 2-5 seconds between products to prevent getting rate-limited
      if (i < products.length - 1) {
        const sleepMs = Math.floor(Math.random() * 3000) + 2000;
        await new Promise(r => setTimeout(r, sleepMs));
      }
    }

    // Send Consolidated Email Digests
    for (const [userId, alerts] of Object.entries(userAlerts)) {
       try {
           const { data: { user } } = await supabase.auth.admin.getUserById(userId);
           if (user?.email) {
             const emailResult = await sendConsolidatedPriceDropAlert(user.email, alerts);
             if (emailResult.success) {
               results.alertsSent += alerts.length;
             }
           }
       } catch(err) {
           console.error("Error sending digest email for user", userId, err);
       }
    }

    // Send Back in Stock Alerts
    for (const [userId, alerts] of Object.entries(userBackInStockAlerts)) {
       try {
           const { data: { user } } = await supabase.auth.admin.getUserById(userId);
           if (user?.email) {
             const { sendBackInStockAlert } = await import("@/lib/email");
             for (const p of alerts) {
               const emailResult = await sendBackInStockAlert(user.email, p);
               if (emailResult.success) {
                 results.alertsSent++;
               }
             }
           }
       } catch(err) {
           console.error("Error sending back in stock email for user", userId, err);
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
