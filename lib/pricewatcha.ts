import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://pricewatcha.com/api/v1";
const API_KEY = process.env.PRICEWATCHA_API_KEY;

export interface PricewatchaProduct {
  productName: string;
  currentPrice: number;
  currencyCode: string;
  productImageUrl: string;
  originalPrice?: number;
}

/**
 * Tracks a product URL using the Pricewatcha API.
 * Uses long-polling and falls back to manual job polling if the scrape takes longer.
 */
export async function trackProduct(url: string): Promise<PricewatchaProduct> {
  if (!API_KEY) {
    throw new Error("PRICEWATCHA_API_KEY is not defined in the environment variables.");
  }

  // 1. Initial track call
  const response = await fetch(`${API_BASE}/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Pricewatcha track failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === "completed" && result.product) {
    return {
      productName: result.product.name,
      currentPrice: result.product.current_price,
      currencyCode: result.product.currency || "INR",
      productImageUrl: result.product.image_url || "",
      originalPrice: result.product.original_price || 0,
    };
  }

  if (result.status === "running" || result.status === "queued") {
    const jobId = result.job_id;
    if (!jobId) {
      throw new Error("Job was queued but no job_id was returned.");
    }
    
    // Poll job status (up to 40 times, once every 3 seconds = up to 2 minutes)
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      const jobResponse = await fetch(`${API_BASE}/jobs/${jobId}`, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
        },
      });
      
      if (!jobResponse.ok) continue;
      
      const jobResult = await jobResponse.json();
      if (jobResult.status === "completed" && jobResult.product) {
        return {
          productName: jobResult.product.name,
          currentPrice: jobResult.product.current_price,
          currencyCode: jobResult.product.currency || "INR",
          productImageUrl: jobResult.product.image_url || "",
          originalPrice: jobResult.product.original_price || 0,
        };
      }
      
      if (jobResult.status === "failed") {
        throw new Error(jobResult.error?.message || "Pricewatcha background job failed");
      }
    }
    
    throw new Error("Pricewatcha tracking job timed out.");
  }

  throw new Error("Unexpected response from Pricewatcha track API");
}

/**
 * Ensures a global webhook subscription is registered for `price_dropped` events
 * pointing to our application's webhook endpoint.
 */
export async function ensureWebhookSubscription() {
  if (!API_KEY) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const targetUrl = `${siteUrl}/api/webhooks/pricewatcha`;

  try {
    // 1. Get existing subscriptions
    const response = await fetch(`${API_BASE}/webhooks`, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to list Pricewatcha webhooks:", response.statusText);
      return;
    }

    const webhooks = await response.json();
    const webhookExists = Array.isArray(webhooks) && webhooks.some((w: any) => w.target_url === targetUrl);

    if (webhookExists) {
      console.log(`Pricewatcha webhook already registered for target: ${targetUrl}`);
      return;
    }

    // 2. Create webhook subscription
    const createResponse = await fetch(`${API_BASE}/webhooks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        target_url: targetUrl,
        event_types: ["price_dropped"],
      }),
    });

    if (!createResponse.ok) {
      const err = await createResponse.json().catch(() => ({}));
      console.error("Failed to register Pricewatcha webhook:", err.error?.message || createResponse.statusText);
      return;
    }

    const newWebhook = await createResponse.json();
    console.log(`Successfully registered Pricewatcha webhook for ${targetUrl}. Secret prefix: ${newWebhook.secret_prefix}`);
    
    // Note: If they want to verify signatures, they should set PRICEWATCHA_WEBHOOK_SECRET in their env.
    // We print a message to the console with instructions on how to obtain and set the secret.
    if (newWebhook.secret) {
      console.warn("=================================================================");
      console.warn("PRICEWATCHA WEBHOOK CREATED!");
      console.warn(`Please add this to your .env file to enable signature verification:`);
      console.warn(`PRICEWATCHA_WEBHOOK_SECRET="${newWebhook.secret}"`);
      console.warn("=================================================================");
    }
  } catch (error) {
    console.error("Error in ensureWebhookSubscription:", error);
  }
}
