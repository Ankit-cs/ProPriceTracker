import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { sendConsolidatedPriceDropAlert, sendLowestPriceAlert, sendThresholdMetAlert } from "@/lib/email";

// Verify HMAC-SHA256 signature
function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    const expectedHeader = `sha256=${expected}`;
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedHeader),
      Buffer.from(signature || "")
    );
  } catch (err) {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const timestamp = req.headers.get("x-pricewatcha-timestamp") || "";
    const signature = req.headers.get("x-pricewatcha-signature") || "";
    const rawBody = await req.text();

    const secret = process.env.PRICEWATCHA_WEBHOOK_SECRET;
    if (secret) {
      const isValid = verifySignature(secret, timestamp, rawBody, signature);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    } else {
      console.warn("[Pricewatcha Webhook] PRICEWATCHA_WEBHOOK_SECRET is not set. Bypassing signature verification.");
    }

    const payload = JSON.parse(rawBody);
    console.log("[Pricewatcha Webhook] Received payload:", JSON.stringify(payload, null, 2));

    const { event_type, product: pwProduct, price: pwPrice } = payload;

    if (event_type !== "price_dropped") {
      console.log(`[Pricewatcha Webhook] Ignored event type: ${event_type}`);
      return NextResponse.json({ success: true, message: `Ignored event: ${event_type}` });
    }

    const url = pwProduct.product_url;
    const newPrice = parseFloat(pwPrice.new_price);
    const oldPrice = parseFloat(pwPrice.old_price);
    const currency = pwProduct.currency || "INR";

    // Initialize Supabase Service Role client to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look up the product in our database
    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .eq("url", url)
      .maybeSingle();

    if (prodErr) throw prodErr;
    if (!product) {
      console.log(`[Pricewatcha Webhook] Product not found in local DB for URL: ${url}`);
      return NextResponse.json({ success: true, message: "Product not tracked in our system" });
    }

    console.log(`[Pricewatcha Webhook] Processing drop for local product: ${product.name} (ID: ${product.id})`);

    const lowestPrice = Math.min(parseFloat(product.lowest_price || newPrice), newPrice);
    const highestPrice = Math.max(parseFloat(product.highest_price || newPrice), newPrice);

    // Fetch history
    const { data: history } = await supabase
      .from("price_history")
      .select("price, checked_at")
      .eq("product_id", product.id)
      .order("checked_at", { ascending: true });

    const historyPrices = history ? history.map(h => parseFloat(h.price)) : [];
    const sum = historyPrices.reduce((acc, p) => acc + p, 0) + newPrice;
    const averagePrice = sum / (historyPrices.length + 1);

    const originalPrice = parseFloat(product.original_price || 0) || newPrice;
    const discountRate = originalPrice > 0 ? ((originalPrice - newPrice) / originalPrice) * 100 : 0;

    const updateData: any = {
      current_price: newPrice,
      lowest_price: lowestPrice,
      highest_price: highestPrice,
      average_price: averagePrice,
      discount_rate: discountRate,
      updated_at: new Date().toISOString(),
    };

    // Update global products table
    const { error: updateErr } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", product.id);

    if (updateErr) throw updateErr;

    // Add price history entry
    await supabase.from("price_history").insert({
      product_id: product.id,
      price: newPrice,
      currency: currency,
    });

    // Query active trackers for this product
    const { data: trackers, error: trackersErr } = await supabase
      .from("user_tracked_products")
      .select("*")
      .eq("product_id", product.id);

    if (trackersErr) throw trackersErr;

    if (trackers && trackers.length > 0) {
      for (const tracker of trackers) {
        if (!tracker.alerts_enabled) continue;

        const baselinePrice = parseFloat(tracker.last_notified_price || product.current_price);
        const targetDiscount = parseFloat(tracker.target_discount_percent || 0);

        if (newPrice < baselinePrice) {
          const priceDrop = baselinePrice - newPrice;
          const percentageDrop = (priceDrop / baselinePrice) * 100;

          const isLowestEver = newPrice < lowestPrice;
          const isThresholdMet = targetDiscount > 0 && percentageDrop >= targetDiscount;

          // Get tracker user email
          const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(tracker.user_id);
          if (userErr || !userData.user || !userData.user.email) {
            console.error(`[Webhook] Could not load user ${tracker.user_id} email:`, userErr);
            continue;
          }

          const userEmail = userData.user.email;

          // Dispatch corresponding alert based on engines
          if (isLowestEver) {
            console.log(`[Webhook Alert] Sending Lowest Ever drop to ${userEmail} for product: ${product.name}`);
            await sendLowestPriceAlert(userEmail, { ...product, ...updateData }, history || []);
          } else if (isThresholdMet) {
            console.log(`[Webhook Alert] Sending Threshold Met drop to ${userEmail} for product: ${product.name}`);
            await sendThresholdMetAlert(userEmail, { ...product, ...updateData }, Math.round(percentageDrop));
          } else if (percentageDrop >= targetDiscount) {
            console.log(`[Webhook Alert] Sending Standard drop digest to ${userEmail} for product: ${product.name}`);
            await sendConsolidatedPriceDropAlert(userEmail, [{
              product: { ...product, ...updateData },
              oldPrice: baselinePrice,
              newPrice: newPrice,
              priceDrop: priceDrop,
              percentageDrop: percentageDrop.toFixed(1),
              history: history || []
            }]);
          }

          // Update user's last notified price
          await supabase
            .from("user_tracked_products")
            .update({ last_notified_price: newPrice })
            .eq("product_id", product.id)
            .eq("user_id", tracker.user_id);
        }
      }
    }

    return NextResponse.json({ success: true, message: "Webhook processed successfully" });
  } catch (error: any) {
    console.error("[Pricewatcha Webhook] Endpoint error:", error);
    return NextResponse.json({ error: error.message || "Failed to process webhook" }, { status: 500 });
  }
}
