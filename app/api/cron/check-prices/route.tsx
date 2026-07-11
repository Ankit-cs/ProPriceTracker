import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeProduct } from "@/lib/firecrawl";
import { scrapeAmazonProduct } from "@/lib/amazon-scraper";
import { cleanAmazonUrl } from "@/lib/url-cleaner";
import { sendConsolidatedPriceDropAlert, sendBackInStockAlert, sendLowestPriceAlert, sendThresholdMetAlert } from "@/lib/email";

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role to bypass RLS and fetch all user info
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all products (each unique product is checked exactly once)
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*");

    if (productsError) throw productsError;

    console.log(`[Cron] Found ${products.length} unique products to check`);

    const results = {
      total: products.length,
      updated: 0,
      failed: 0,
      priceChanges: 0,
      alertsSent: 0,
    };

    const userAlerts: Record<string, any[]> = {};
    const userBackInStockAlerts: Record<string, any[]> = {};
    const userLowestPriceAlerts: Record<string, any[]> = {};
    const userThresholdMetAlerts: Record<string, any[]> = {};

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      try {
        let productData;
        const isAmazon = product.url.includes("amazon.") || product.url.includes("amzn.");
        const cleanUrl = isAmazon ? cleanAmazonUrl(product.url) : product.url;
        
        // Fetch all distinct pincodes among users tracking this product
        const { data: trackers, error: trackersError } = await supabase
          .from("user_tracked_products")
          .select("*")
          .eq("product_id", product.id);

        if (trackersError) throw trackersError;

        // Use the first user's pincode as default or fallback
        const trackingPincode = trackers.find(t => t.pincode)?.pincode || undefined;

        if (isAmazon) {
          productData = await scrapeAmazonProduct(cleanUrl, "in", trackingPincode);
        } else {
          productData = await scrapeProduct(cleanUrl);
        }

        if (!productData.currentPrice) {
          results.failed++;
          continue;
        }

        const newPrice = productData.currentPrice;
        const oldPrice = parseFloat(product.current_price);
        const originalPrice = productData.originalPrice || parseFloat(product.original_price || 0);

        // Calculate Aggregates
        const lowestPrice = Math.min(parseFloat(product.lowest_price || newPrice), newPrice);
        const highestPrice = Math.max(parseFloat(product.highest_price || newPrice), newPrice);
        
        const { data: history } = await supabase
          .from("price_history")
          .select("price, checked_at")
          .eq("product_id", product.id)
          .order("checked_at", { ascending: true });
        
        const historyPrices = history ? history.map(h => parseFloat(h.price)) : [];
        const sum = historyPrices.reduce((acc, p) => acc + p, 0) + newPrice;
        const averagePrice = sum / (historyPrices.length + 1);
        const discountRate = originalPrice > 0 ? ((originalPrice - newPrice) / originalPrice) * 100 : 0;

        const updateData: any = {
          current_price: newPrice,
          currency: productData.currencyCode || product.currency,
          name: productData.productName || product.name,
          image_url: productData.productImageUrl || product.image_url,
          updated_at: new Date().toISOString(),
          lowest_price: lowestPrice,
          highest_price: highestPrice,
          average_price: averagePrice,
          discount_rate: discountRate,
        };

        if (productData.amazonId !== undefined) {
          updateData.amazon_id = productData.amazonId;
          updateData.rating = productData.rating || 0;
          updateData.reviews_count = productData.reviewsCount || 0;
          updateData.short_description = productData.shortDescription || "";
          updateData.full_description = productData.fullDescription || "";
          updateData.is_amazon_choice = productData.isAmazonChoice || false;
          updateData.is_discounted = productData.isDiscounted || false;
          updateData.original_price = originalPrice;
          updateData.is_in_stock = productData.isInStock !== undefined ? productData.isInStock : true;
        }

        if (newPrice !== oldPrice) {
          results.priceChanges++;
        }

        // Process individual user notifications
        for (const tracker of trackers) {
          // 1. Back in stock alert
          const wasOutOfStock = product.is_in_stock === false;
          const isNowInStock = updateData.is_in_stock === true;
          if (wasOutOfStock && isNowInStock) {
            if (!userBackInStockAlerts[tracker.user_id]) {
              userBackInStockAlerts[tracker.user_id] = [];
            }
            userBackInStockAlerts[tracker.user_id].push({ ...product, ...updateData });
          }

          // 2. Price drop alerts based on user-specific thresholds
          const baselinePrice = parseFloat(tracker.last_notified_price || product.current_price);
          const targetDiscount = parseFloat(tracker.target_discount_percent || 0);

          if (newPrice < baselinePrice && tracker.alerts_enabled) {
            const priceDrop = baselinePrice - newPrice;
            const percentageDrop = (priceDrop / baselinePrice) * 100;
            
            // Smart Notification Decision Engine
            const isLowestEver = newPrice < lowestPrice;
            const isThresholdMet = targetDiscount > 0 && percentageDrop >= targetDiscount;

            if (isLowestEver) {
              // Priority 1: Lowest Price Ever
              if (!userLowestPriceAlerts[tracker.user_id]) userLowestPriceAlerts[tracker.user_id] = [];
              userLowestPriceAlerts[tracker.user_id].push({ ...product, ...updateData, history });
            } else if (isThresholdMet) {
              // Priority 2: Massive Target Discount Met
              if (!userThresholdMetAlerts[tracker.user_id]) userThresholdMetAlerts[tracker.user_id] = [];
              userThresholdMetAlerts[tracker.user_id].push({
                product: { ...product, ...updateData },
                discountPercentage: percentageDrop.toFixed(0)
              });
            } else if (percentageDrop >= targetDiscount) { // Default threshold for regular drops
              // Priority 3: Consolidated standard drop
              if (!userAlerts[tracker.user_id]) userAlerts[tracker.user_id] = [];
              userAlerts[tracker.user_id].push({
                product: { ...product, ...updateData },
                oldPrice: baselinePrice,
                newPrice: newPrice,
                priceDrop: priceDrop,
                percentageDrop: percentageDrop.toFixed(1),
                history
              });
            }

            if (isLowestEver || isThresholdMet || percentageDrop >= targetDiscount) {
              // Update user's last notified price
              await supabase
                .from("user_tracked_products")
                .update({ last_notified_price: newPrice })
                .eq("product_id", product.id)
                .eq("user_id", tracker.user_id);
            }
          }
        }

        // Update global product table
        await supabase
          .from("products")
          .update(updateData)
          .eq("id", product.id);

        // Store new check in price history
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

      // Smart Delays to avoid throttling
      if (i < products.length - 1) {
        const sleepMs = Math.floor(Math.random() * 3000) + 2000;
        await new Promise(r => setTimeout(r, sleepMs));
      }
    }

    // Send Consolidated Email Digests
    for (const [userId, alerts] of Object.entries(userAlerts)) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        
        // Webhook Notification
        const { data: userSettings } = await supabase.from('user_settings').select('webhook_url').eq('user_id', userId).single();
        if (userSettings?.webhook_url) {
          try {
            await fetch(userSettings.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'price_drop', alerts })
            });
          } catch (err) {
            console.error("Failed to send webhook for user", userId, err);
          }
        }

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
        
        // Webhook Notification
        const { data: userSettings } = await supabase.from('user_settings').select('webhook_url').eq('user_id', userId).single();
        if (userSettings?.webhook_url) {
          try {
            await fetch(userSettings.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'back_in_stock', alerts })
            });
          } catch (err) {
            console.error("Failed to send webhook for user", userId, err);
          }
        }

        if (user?.email) {
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

    // Send Lowest Price Alerts
    for (const [userId, alerts] of Object.entries(userLowestPriceAlerts)) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (user?.email) {
          for (const p of alerts) {
            const emailResult = await sendLowestPriceAlert(user.email, p, p.history);
            if (emailResult.success) results.alertsSent++;
          }
        }
      } catch(err) {
        console.error("Error sending lowest price email for user", userId, err);
      }
    }

    // Send Threshold Met Alerts
    for (const [userId, alerts] of Object.entries(userThresholdMetAlerts)) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (user?.email) {
          for (const a of alerts) {
            const emailResult = await sendThresholdMetAlert(user.email, a.product, a.discountPercentage);
            if (emailResult.success) results.alertsSent++;
          }
        }
      } catch(err) {
        console.error("Error sending threshold met email for user", userId, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Price check completed",
      results,
    });
  } catch (error: any) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Price check endpoint is working. Use POST to trigger.",
  });
}
