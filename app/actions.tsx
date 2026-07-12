"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { scrapeProduct } from "@/lib/firecrawl";
import { scrapeAmazonProduct } from "@/lib/amazon-scraper";
import { trackProduct, ensureWebhookSubscription } from "@/lib/pricewatcha";
import { cleanAmazonUrl, cleanFlipkartUrl, cleanMyntraUrl } from "@/lib/url-cleaner";
import { checkRateLimit } from "@/lib/redis";
import { fetchPriceHistorySlug, getEnhancedPriceData } from "@/lib/price-history-crawler";
import { searchAmazonProducts } from "@/lib/amazon-search-scraper";
import { scrapeFlipkartProduct } from "@/lib/flipkart-scraper";
import { scrapeMyntraProduct } from "@/lib/myntra-scraper";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const BYPASS_AUTH = false; // Set to true only for local testing (disables auth)

const getServiceRoleClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function getMockUser() {
  try {
    const supabase = getServiceRoleClient();
    const { data: { users } } = await supabase.auth.admin.listUsers();
    if (users && users.length > 0) {
      return { id: users[0].id, email: users[0].email };
    }
    const { data: products } = await supabase.from("products").select("user_id").limit(1);
    if (products && products.length > 0) {
      return { id: products[0].user_id, email: "test@example.com" };
    }
  } catch (e) {
    console.error("Mock user helper error:", e);
  }
  return null;
}

export async function isBypassAuthEnabled() {
  return BYPASS_AUTH;
}

export async function addProduct(formData) {
  const rawUrl = formData.get("url");

  if (!rawUrl) {
    return { error: "URL is required" };
  }

  const isAmazon = rawUrl.includes("amazon.") || rawUrl.includes("amzn.");
  const isFlipkart = rawUrl.includes("flipkart.");
  const isMyntra = rawUrl.includes("myntra.");

  let url = rawUrl;
  if (isAmazon) url = cleanAmazonUrl(rawUrl);
  else if (isFlipkart) url = cleanFlipkartUrl(rawUrl);
  else if (isMyntra) url = cleanMyntraUrl(rawUrl);

  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Apply Rate Limiting
    const rateLimit = await checkRateLimit(user.id);
    if (!rateLimit.success) {
      return { error: "Too many requests. Please try again in a minute." };
    }

    // Create a background job for scraping
    const { data: job, error: jobErr } = await supabase
      .from("scraping_jobs")
      .insert({
        url,
        user_id: user.id,
        status: "pending"
      })
      .select()
      .single();

    if (jobErr) throw jobErr;

    // Trigger background worker asynchronously without waiting
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    try {
      const { headers } = await import("next/headers");
      const headersList = await headers();
      const host = headersList.get("host");
      if (host) {
         const protocol = host.includes("localhost") ? "http" : "https";
         baseUrl = `${protocol}://${host}`;
      }
    } catch(e) {}
    
    fetch(`${baseUrl}/api/jobs/worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: job.id })
    }).catch(console.error);

    return {
      success: true,
      job_id: job.id,
      message: "Scraping job queued! Please wait..."
    };
  } catch (error: any) {
    console.error("Add product error:", error);
    return { error: error.message || "Failed to add product" };
  }
}

export async function addMultipleProducts(formData: FormData) {
  const rawUrlsString = formData.get("urls") as string;
  if (!rawUrlsString) return { error: "URLs are required" };

  const rawUrls = rawUrlsString.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
  
  if (rawUrls.length === 0) return { error: "No valid URLs found" };
  
  const results = [];
  const jobIds = [];
  for (let i = 0; i < rawUrls.length; i++) {
     const rawUrl = rawUrls[i];
     const singleFormData = new FormData();
     singleFormData.append("url", rawUrl);
     const result = await addProduct(singleFormData);
     results.push(result);
     if (result.success && result.job_id) {
       jobIds.push(result.job_id);
     }
  }
  
  const successes = results.filter(r => r.success).length;
  const fails = results.length - successes;
  
  if (successes === 0) {
    return { error: results[0]?.error || "Failed to queue products. Please check the URLs and try again." };
  }

  return { 
     success: successes > 0, 
     job_ids: jobIds,
     message: `Successfully queued ${successes} products. ${fails > 0 ? `Failed ${fails}.` : ''}` 
  };
}

export async function processScrapingJob(job_id: string) {
  try {
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(await cookies());

    // 1. Fetch Job
    const { data: job, error: jobErr } = await supabase
      .from("scraping_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return { error: "Job not found" };
    }

    if (job.status !== "pending") {
      return { error: "Job already running or completed" };
    }

    // Mark running
    await supabase.from("scraping_jobs").update({ status: "running" }).eq("id", job_id);

    const url = job.url;
    const isAmazon = url.includes("amazon.") || url.includes("amzn.");
    const isFlipkart = url.includes("flipkart.");
    const isMyntra = url.includes("myntra.");
    
    // Check if product already exists globally
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id, current_price, lowest_price, highest_price, average_price, original_price")
      .eq("url", url)
      .maybeSingle();

    const isUpdate = !!existingProduct;

    // Scrape
    let productData;
    try {
      if (isAmazon) {
        let pincode;
        if (existingProduct) {
          const { data: existingJoin } = await supabase
            .from("user_tracked_products")
            .select("pincode")
            .eq("user_id", job.user_id)
            .eq("product_id", existingProduct.id)
            .maybeSingle();
          pincode = existingJoin?.pincode;
        }
        productData = await scrapeAmazonProduct(url, "in", pincode);
      } else if (isFlipkart) {
        productData = await scrapeFlipkartProduct(url);
        // Track async for webhooks/background usage
        trackProduct(url).catch(() => {});
        ensureWebhookSubscription().catch(() => {});
      } else if (isMyntra) {
        productData = await scrapeMyntraProduct(url);
        trackProduct(url).catch(() => {});
        ensureWebhookSubscription().catch(() => {});
      } else {
        try {
          productData = await trackProduct(url);
        } catch (pwErr) {
          console.warn("Pricewatcha tracking failed or timed out, falling back to Firecrawl entirely:", pwErr);
          productData = await scrapeProduct(url);
          // Note: If Pricewatcha fails, we don't get webhooks, but we still get the product.
        }
        
        try {
          // Fallback to Firecrawl for rich metadata since Pricewatcha only provides core price
          // Only do this if we didn't already use Firecrawl as the main scraper
          if (!productData.productImageUrl || !productData.originalPrice) {
            const fcData = await scrapeProduct(url);
            if (fcData.productImageUrl) productData.productImageUrl = fcData.productImageUrl;
            if (fcData.originalPrice) productData.originalPrice = fcData.originalPrice;
            if (fcData.rating) productData.rating = fcData.rating;
            if (fcData.reviewsCount) productData.reviewsCount = fcData.reviewsCount;
            // Also if trackProduct failed to get currentPrice but didn't throw (unlikely), use fcData
            if (!productData.currentPrice && fcData.currentPrice) {
               productData.currentPrice = fcData.currentPrice;
               productData.productName = fcData.productName;
            }
          }
        } catch (fcErr) {
          console.warn("Firecrawl enhancement failed:", fcErr);
        }

        // Register/ensure webhook subscription in the background
        ensureWebhookSubscription().catch(console.error);
      }
    } catch (scrapeErr: any) {
      await supabase.from("scraping_jobs").update({ status: "failed", error_message: scrapeErr.message }).eq("id", job_id);
      return { error: "Scrape failed" };
    }

    if (!productData.productName || !productData.currentPrice) {
      await supabase.from("scraping_jobs").update({ status: "failed", error_message: "Could not extract info" }).eq("id", job_id);
      return { error: "Extract failed" };
    }

    const newPrice = productData.currentPrice;
    const currency = productData.currencyCode || productData.currency || "INR";

    let lowestPrice = newPrice;
    let highestPrice = newPrice;
    let averagePrice = newPrice;
    let slug = null;
    let scrapedHistory = [];

    if (existingProduct) {
      const { data: history } = await supabase
        .from("price_history")
        .select("price")
        .eq("product_id", existingProduct.id);
      
      const historyPrices = history ? history.map(h => parseFloat(h.price)) : [];
      const allPrices = [...historyPrices, newPrice].filter(p => !isNaN(p) && p > 0);
      
      if (allPrices.length > 0) {
        lowestPrice = Math.min(...allPrices);
        highestPrice = Math.max(...allPrices);
        const sum = allPrices.reduce((acc, p) => acc + p, 0);
        averagePrice = sum / allPrices.length;
      }
    } else {
      slug = await fetchPriceHistorySlug(productData.productName);
      if (slug) {
        const enhancedData = await getEnhancedPriceData(slug);
        if (enhancedData) {
          lowestPrice = Math.min(newPrice, enhancedData.lowestPrice);
          highestPrice = Math.max(newPrice, enhancedData.highestPrice);
          averagePrice = enhancedData.averagePrice;
          scrapedHistory = enhancedData.priceHistory || [];
        }
      }
    }

    const originalPrice = productData.originalPrice || (existingProduct ? parseFloat(existingProduct.original_price || 0) : 0);
    const discountRate = originalPrice > 0 ? ((originalPrice - newPrice) / originalPrice) * 100 : 0;

    const updateData: any = {
      url,
      name: productData.productName,
      current_price: newPrice,
      currency: currency,
      image_url: productData.productImageUrl,
      updated_at: new Date().toISOString(),
      lowest_price: lowestPrice,
      highest_price: highestPrice,
      average_price: averagePrice,
      discount_rate: discountRate,
    };

    if (slug) updateData.geturl = slug;

    // Assign generic metadata
    if (productData.rating !== undefined) updateData.rating = productData.rating;
    if (productData.reviewsCount !== undefined) updateData.reviews_count = productData.reviewsCount;
    updateData.original_price = originalPrice;

    // Assign Amazon/Flipkart/Myntra specific metadata
    if (productData.amazonId !== undefined || isFlipkart || isMyntra) {
      if (productData.amazonId !== undefined) updateData.amazon_id = productData.amazonId;
      updateData.short_description = productData.shortDescription || "";
      updateData.full_description = productData.fullDescription || "";
      updateData.is_amazon_choice = productData.isAmazonChoice || false;
      updateData.is_discounted = productData.isDiscounted || false;
      updateData.sold_by = productData.soldBy || null;
      updateData.delivery_date = productData.deliveryDate || null;
      updateData.is_in_stock = productData.isInStock !== undefined ? productData.isInStock : true;
    }

    let product;
    if (existingProduct) {
      const { data: updatedProduct, error: updateErr } = await supabase.from("products").update(updateData).eq("id", existingProduct.id).select().single();
      if (updateErr) throw updateErr;
      product = updatedProduct;
    } else {
      const { data: insertedProduct, error: insertErr } = await supabase.from("products").insert(updateData).select().single();
      if (insertErr) throw insertErr;
      product = insertedProduct;
    }

    // Join table
    await supabase.from("user_tracked_products").upsert({
      user_id: job.user_id,
      product_id: product.id,
      last_notified_price: newPrice,
    }, { onConflict: "user_id,product_id", ignoreDuplicates: false });

    // Price history
    await supabase.from("price_history").insert({ product_id: product.id, price: newPrice, currency: currency });

    // Insert historical chart data if we fetched it
    if (scrapedHistory && scrapedHistory.length > 0) {
      const historyPayload = scrapedHistory.map(item => ({
        product_id: product.id,
        price: item.price,
        currency: currency,
        checked_at: new Date(item.date).toISOString()
      }));
      await supabase.from("price_history").insert(historyPayload);
    }

    // Mark job completed
    await supabase.from("scraping_jobs").update({ status: "completed", product_id: product.id }).eq("id", job_id);

    return { success: true, product };
  } catch (err: any) {
    console.error("Worker error:", err);
    return { error: err.message };
  }
}

export async function deleteProduct(productId) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }
    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase
      .from("user_tracked_products")
      .delete()
      .eq("product_id", productId)
      .eq("user_id", user.id);

    if (error) throw error;

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getProducts() {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    // Get all products globally
    const { data: allProducts, error: prodError } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (prodError) throw prodError;

    if (!user) {
      return allProducts || [];
    }

    // Get user-specific tracking settings
    const { data: relations } = await supabase
      .from("user_tracked_products")
      .select("*")
      .eq("user_id", user.id);

    const relationsMap = new Map(relations?.map(r => [r.product_id, r]));

    // Merge user settings into product rows
    const mergedProducts = allProducts.map(p => {
      const userSettings = relationsMap.get(p.id);
      return {
        ...p,
        alerts_enabled: userSettings ? userSettings.alerts_enabled : false,
        target_discount_percent: userSettings ? userSettings.target_discount_percent : 0,
        last_notified_price: userSettings ? userSettings.last_notified_price : p.current_price,
        pincode: userSettings ? userSettings.pincode : null,
        is_user_tracking: !!userSettings
      };
    });

    return mergedProducts.filter(p => p.is_user_tracking);
  } catch (error) {
    console.error("Get products error:", error);
    return [];
  }
}

export async function getSimilarProducts(excludeProductId: string) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .neq("id", excludeProductId)
      .order("discount_rate", { ascending: false })
      .limit(3);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get similar products error:", error);
    return [];
  }
}

export async function getPriceHistory(productId) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    const { data, error } = await supabase
      .from("price_history")
      .select("*")
      .eq("product_id", productId)
      .order("checked_at", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get price history error:", error);
    return [];
  }
}

export async function ensurePriceHistory(productId: string) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    // First, check how much history exists
    const { count, error: countErr } = await supabase
      .from("price_history")
      .select("*", { count: "exact", head: true })
      .eq("product_id", productId);
      
    if (countErr) throw countErr;
    
    // If we already have more than 1 entry, no need to backfill
    if (count && count > 1) {
      return { success: true, message: "History already exists" };
    }

    // Fetch product details to get the name
    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (prodErr || !product || !product.name) {
      return { error: "Product not found or missing name" };
    }

    // Attempt to backfill
    const slug = await fetchPriceHistorySlug(product.name);
    if (!slug) {
      return { error: "Could not find history slug for this product" };
    }

    const enhancedData = await getEnhancedPriceData(slug);
    if (!enhancedData || !enhancedData.priceHistory || enhancedData.priceHistory.length === 0) {
      return { error: "No historical data found" };
    }

    // Insert historical chart data
    const historyPayload = enhancedData.priceHistory.map((item: any) => ({
      product_id: product.id,
      price: item.price,
      currency: product.currency || "INR",
      checked_at: new Date(item.date).toISOString()
    }));

    const { error: insertErr } = await supabase.from("price_history").insert(historyPayload);
    if (insertErr) throw insertErr;

    // Now update the product's aggregates to match the newly filled chart data
    const allPrices = [product.current_price, ...historyPayload.map((h: any) => h.price)].filter(p => !isNaN(p) && p > 0);
    
    if (allPrices.length > 0) {
       const lowestPrice = Math.min(...allPrices);
       const highestPrice = Math.max(...allPrices);
       const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
       
       await supabase.from("products").update({
         lowest_price: lowestPrice,
         highest_price: highestPrice,
         average_price: avgPrice
       }).eq("id", product.id);
    }

    return { success: true, message: "History backfilled successfully" };
  } catch (error: any) {
    console.error("Ensure price history error:", error);
    return { error: error.message };
  }
}

export async function testPriceDropEmail(productId) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user || !user.email) {
      return { error: "User not authenticated or email missing" };
    }

    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error || !product) {
      return { error: "Product not found" };
    }

    // Simulate a 10% price drop
    const oldPrice = parseFloat(product.current_price) * 1.1;
    const newPrice = parseFloat(product.current_price);
    const priceDrop = oldPrice - newPrice;
    const percentageDrop = "10.00";
    
    const { sendConsolidatedPriceDropAlert } = await import("@/lib/email");
    
    const result = await sendConsolidatedPriceDropAlert(
      user.email,
      [{
        product,
        oldPrice,
        newPrice,
        priceDrop,
        percentageDrop
      }]
    );

    if (result.error) throw new Error(result.error);
    return { success: true };
  } catch (error: any) {
    console.error("Test email error:", error);
    return { error: error.message || "Failed to send test email" };
  }
}

export async function signOut() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/");
}

export async function searchAmazon(keyword: string, limit = 10) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return { error: "Not authenticated" };
    }

    const results = await searchAmazonProducts(keyword, limit);
    return { success: true, results };
  } catch (error: any) {
    console.error("Search Amazon error:", error);
    return { error: error.message || "Failed to search Amazon" };
  }
}

export async function toggleAlerts(productId: string, enabled: boolean, targetDiscountPercent: number = 0) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return { error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("user_tracked_products")
      .update({ alerts_enabled: enabled, target_discount_percent: targetDiscountPercent })
      .eq("product_id", productId)
      .eq("user_id", user.id);

    if (error) throw error;

    revalidatePath("/");
    return { success: true, alertsEnabled: enabled };
  } catch (error: any) {
    console.error("Toggle alerts error:", error);
    return { error: error.message || "Failed to toggle alerts" };
  }
}

export async function updateProductPincode(productId: string, url: string, pincode: string) {
  const cookieStore = await cookies();
  const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
  
  let user;
  if (BYPASS_AUTH) {
    user = await getMockUser();
  } else {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    user = authUser;
  }

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Update DB with the new pincode first in the join table
  await supabase
    .from("user_tracked_products")
    .update({ pincode })
    .eq("product_id", productId)
    .eq("user_id", user.id);

  // Re-scrape with new pincode
  const region = 'in'; // Fixed to India for this app
  const productData = await scrapeAmazonProduct(url, region, pincode);

  if (!productData.productName || !productData.currentPrice) {
    return { error: "Could not extract product information from this URL" };
  }

  const updateData: any = {
    current_price: productData.currentPrice,
    updated_at: new Date().toISOString(),
    is_in_stock: productData.isInStock !== undefined ? productData.isInStock : true,
    sold_by: productData.soldBy || null,
    delivery_date: productData.deliveryDate || null,
  };

  const { data: product, error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", productId)
    .select()
    .single();

  if (error) {
     return { error: error.message };
  }
  
  revalidatePath("/");
  return { success: true, product };
}

export async function refreshProductPrice(productId: string) {
  try {
    const cookieStore = await cookies();
    const bypassAuth = await isBypassAuthEnabled();
    const supabase = bypassAuth ? getServiceRoleClient() : createClient(cookieStore);

    let user;
    if (bypassAuth) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Get the product URL and existing details
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (fetchError || !product) {
      return { error: "Product not found" };
    }

    // Get pincode if available for this tracker to scrape delivery info too
    const { data: tracker } = await supabase
      .from("user_tracked_products")
      .select("pincode")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle();

    const isAmazon = product.url.includes("amazon.") || product.url.includes("amzn.");
    const isFlipkart = product.url.includes("flipkart.");
    const isMyntra = product.url.includes("myntra.");

    let cleanUrl = product.url;
    if (isAmazon) cleanUrl = cleanAmazonUrl(product.url);
    else if (isFlipkart) cleanUrl = cleanFlipkartUrl(product.url);
    else if (isMyntra) cleanUrl = cleanMyntraUrl(product.url);

    let productData;
    if (isAmazon) {
      productData = await scrapeAmazonProduct(cleanUrl, "in", tracker?.pincode || undefined);
    } else if (isFlipkart) {
      productData = await scrapeFlipkartProduct(cleanUrl);
    } else if (isMyntra) {
      productData = await scrapeMyntraProduct(cleanUrl);
    } else {
      productData = await scrapeProduct(cleanUrl);
    }

    if (!productData.currentPrice) {
      return { error: "Could not extract product information" };
    }

    const newPrice = productData.currentPrice;
    const originalPrice = productData.originalPrice || parseFloat(product.original_price || 0);

    // Calculate Aggregates from all history
    const { data: history } = await supabase
      .from("price_history")
      .select("price")
      .eq("product_id", productId);

    const historyPrices = history ? history.map(h => parseFloat(h.price)) : [];
    const allPrices = [...historyPrices, newPrice].filter(p => !isNaN(p) && p > 0);
    
    let lowestPrice = newPrice;
    let highestPrice = newPrice;
    let averagePrice = newPrice;
    
    if (allPrices.length > 0) {
       lowestPrice = Math.min(...allPrices);
       highestPrice = Math.max(...allPrices);
       averagePrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
    }
    const discountRate = originalPrice > 0 ? ((originalPrice - newPrice) / originalPrice) * 100 : 0;

    const updateData: any = {
      current_price: newPrice,
      currency: productData.currency || product.currency,
      name: productData.productName || product.name,
      image_url: productData.productImageUrl || product.image_url,
      updated_at: new Date().toISOString(),
      lowest_price: lowestPrice,
      highest_price: highestPrice,
      average_price: averagePrice,
      discount_rate: discountRate,
    };

    // Assign generic metadata
    if (productData.rating !== undefined) updateData.rating = productData.rating;
    if (productData.reviewsCount !== undefined) updateData.reviews_count = productData.reviewsCount;
    updateData.original_price = originalPrice;

    // Assign Amazon/Flipkart/Myntra specific metadata
    if (productData.amazonId !== undefined || isFlipkart || isMyntra) {
      if (productData.amazonId !== undefined) updateData.amazon_id = productData.amazonId;
      updateData.short_description = productData.shortDescription || "";
      updateData.full_description = productData.fullDescription || "";
      updateData.is_amazon_choice = productData.isAmazonChoice || false;
      updateData.is_discounted = productData.isDiscounted || false;
      updateData.is_in_stock = productData.isInStock !== undefined ? productData.isInStock : true;
      updateData.sold_by = productData.soldBy || null;
      updateData.delivery_date = productData.deliveryDate || null;
    }

    // Update global product table
    await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId);

    // Store new check in price history
    await supabase.from("price_history").insert({
      product_id: productId,
      price: newPrice,
      currency: productData.currency || product.currency,
    });

    revalidatePath("/");
    return { success: true, newPrice };
  } catch (error: any) {
    console.error("Refresh product price error:", error);
    return { error: error.message || "Failed to refresh product" };
  }
}

export async function addUserEmailToProduct(productId: string, email: string) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return { error: "Not authenticated" };
    }

    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();
      
    if (!product) return { error: "Product not found" };

    const { error: joinError } = await supabase
      .from("user_tracked_products")
      .upsert({
        user_id: user.id,
        product_id: productId,
        alerts_enabled: true,
        last_notified_price: product.current_price,
      }, {
        onConflict: "user_id,product_id",
        ignoreDuplicates: false
      });

    if (joinError) throw joinError;

    const { sendWelcomeAlert } = await import("@/lib/email");
    await sendWelcomeAlert(email, product);

    revalidatePath("/");
    return { success: true, message: "Successfully subscribed to alerts!" };
  } catch (error: any) {
    console.error("Add email to product error:", error);
    return { error: error.message || "Failed to subscribe to product" };
  }
}

export async function getWebhookUrl() {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return { error: "Not authenticated" };
    }

    const { data: userSettings, error } = await supabase
      .from("user_settings")
      .select("webhook_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    
    return { success: true, webhookUrl: userSettings?.webhook_url || "" };
  } catch (error: any) {
    console.error("Get webhook error:", error);
    return { error: error.message || "Failed to get webhook" };
  }
}

export async function saveWebhookUrl(webhookUrl: string) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return { error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        webhook_url: webhookUrl
      }, {
        onConflict: "user_id"
      });

    if (error) throw error;

    revalidatePath("/connect");
    return { success: true };
  } catch (error: any) {
    console.error("Save webhook error:", error);
    return { error: error.message || "Failed to save webhook" };
  }
}

export async function uploadAvatar(formData: FormData) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (BYPASS_AUTH) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return { error: "Not authenticated" };
    }

    const file = formData.get("file") as File;
    if (!file) {
      return { error: "No file provided" };
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Ensure avatars bucket exists
    const serviceClient = getServiceRoleClient();
    const { data: buckets } = await serviceClient.storage.listBuckets();
    const avatarsBucketExists = buckets?.some(b => b.name === 'avatars');
    
    if (!avatarsBucketExists) {
      await serviceClient.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
      });
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Update User Metadata
    if (!BYPASS_AUTH) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });
      if (updateError) throw updateError;
    } else {
      // For mock user, just return success since we can't update admin user metadata easily here
      console.log("Mock user avatar updated to:", publicUrl);
    }

    revalidatePath("/");
    return { success: true, avatarUrl: publicUrl };
  } catch (error: any) {
    console.error("Upload avatar error:", error);
    return { error: error.message || "Failed to upload avatar" };
  }
}

export async function getProductById(productId: string) {
  try {
    const cookieStore = await cookies();
    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(cookieStore);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();
    if (error) throw error;
    return { success: true, product: data };
  } catch (error: any) {
    console.error("Get product by ID error:", error);
    return { error: error.message || "Failed to fetch product details" };
  }
}


