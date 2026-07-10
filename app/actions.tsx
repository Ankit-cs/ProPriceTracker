"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { scrapeProduct } from "@/lib/firecrawl";
import { scrapeAmazonProduct } from "@/lib/amazon-scraper";
import { cleanAmazonUrl } from "@/lib/url-cleaner";
import { checkRateLimit } from "@/lib/redis";
import { fetchPriceHistorySlug, getEnhancedPriceData } from "@/lib/price-history-crawler";
import { searchAmazonProducts } from "@/lib/amazon-search-scraper";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const BYPASS_AUTH = false; // Bypass authentication for local testing

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
  const url = isAmazon ? cleanAmazonUrl(rawUrl) : rawUrl;

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

    // Check if product exists globally
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id, current_price, lowest_price, highest_price, average_price, original_price")
      .eq("url", url)
      .maybeSingle();

    const isUpdate = !!existingProduct;

    // Scrape product data with Amazon Scraper or Firecrawl
    let productData;
    if (isAmazon) {
      let pincode;
      if (existingProduct) {
        const { data: existingJoin } = await supabase
          .from("user_tracked_products")
          .select("pincode")
          .eq("user_id", user.id)
          .eq("product_id", existingProduct.id)
          .maybeSingle();
        pincode = existingJoin?.pincode;
      }
      productData = await scrapeAmazonProduct(url, "in", pincode);
    } else {
      productData = await scrapeProduct(url);
    }

    if (!productData.productName || !productData.currentPrice) {
      console.log(productData, "productData");
      return { error: "Could not extract product information from this URL" };
    }

    const newPrice = productData.currentPrice;
    const currency = productData.currencyCode || productData.currency || "INR";

    // Recalculate Aggregates
    let lowestPrice = newPrice;
    let highestPrice = newPrice;
    let averagePrice = newPrice;
    let slug = null;
    let scrapedHistory = [];

    if (existingProduct) {
      lowestPrice = Math.min(parseFloat(existingProduct.lowest_price || newPrice), newPrice);
      highestPrice = Math.max(parseFloat(existingProduct.highest_price || newPrice), newPrice);
      
      const { data: history } = await supabase
        .from("price_history")
        .select("price")
        .eq("product_id", existingProduct.id);
      
      if (history && history.length > 0) {
        const sum = history.reduce((acc, item) => acc + parseFloat(item.price), 0) + newPrice;
        averagePrice = sum / (history.length + 1);
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

    if (slug) {
      updateData.geturl = slug;
    }

    if (productData.amazonId !== undefined) {
      updateData.amazon_id = productData.amazonId;
      updateData.rating = productData.rating || 0;
      updateData.reviews_count = productData.reviewsCount || 0;
      updateData.short_description = productData.shortDescription || "";
      updateData.full_description = productData.fullDescription || "";
      updateData.is_amazon_choice = productData.isAmazonChoice || false;
      updateData.is_discounted = productData.isDiscounted || false;
      updateData.original_price = originalPrice;
    }

    // Insert or update global product
    let product;
    if (existingProduct) {
      const { data: updatedProduct, error: updateErr } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", existingProduct.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      product = updatedProduct;
    } else {
      const { data: insertedProduct, error: insertErr } = await supabase
        .from("products")
        .insert(updateData)
        .select()
        .single();
      if (insertErr) throw insertErr;
      product = insertedProduct;
    }

    // Insert or update join table for multi-tenant mapping
    const { error: joinError } = await supabase
      .from("user_tracked_products")
      .upsert({
        user_id: user.id,
        product_id: product.id,
        last_notified_price: newPrice,
      }, {
        onConflict: "user_id,product_id",
        ignoreDuplicates: false
      });

    if (joinError) throw joinError;

    // Always add current price to price history
    await supabase.from("price_history").insert({
      product_id: product.id,
      price: newPrice,
      currency: currency,
    });

    // Populate historical points if database doesn't have any yet (only last 90 days)
    if (scrapedHistory.length > 0) {
      const { count } = await supabase
        .from("price_history")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id);

      if (count <= 1) { // 1 because we just inserted the current price above
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const filteredHistory = scrapedHistory.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= ninetyDaysAgo;
        });

        if (filteredHistory.length > 0) {
          const historyInserts = filteredHistory.map(item => ({
            product_id: product.id,
            price: item.price,
            currency: currency,
            checked_at: new Date(item.date).toISOString(),
          }));
          await supabase.from("price_history").insert(historyInserts);
        }
      }
    }

    if (!isUpdate && user.email) {
      const { sendWelcomeAlert } = await import("@/lib/email");
      sendWelcomeAlert(user.email, product);
    }

    revalidatePath("/");
    return {
      success: true,
      product,
      message: isUpdate
        ? "Product updated with latest price!"
        : "Product added successfully!",
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
  for (let i = 0; i < rawUrls.length; i++) {
     const rawUrl = rawUrls[i];
     const singleFormData = new FormData();
     singleFormData.append("url", rawUrl);
     const result = await addProduct(singleFormData);
     results.push(result);
     
     if (i < rawUrls.length - 1) {
       await new Promise(r => setTimeout(r, 3000));
     }
  }
  
  const successes = results.filter(r => r.success).length;
  const fails = results.length - successes;
  
  if (successes === 0) {
    return { error: results[0]?.error || "Failed to add products. Please check the URLs and try again." };
  }

  return { 
     success: successes > 0, 
     message: `Successfully added ${successes} products. ${fails > 0 ? `Failed ${fails}.` : ''}` 
  };
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

    return mergedProducts;
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
