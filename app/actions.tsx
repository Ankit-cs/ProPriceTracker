"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { scrapeProduct } from "@/lib/firecrawl";
import { scrapeAmazonProduct, cleanAmazonUrl } from "@/lib/amazon-scraper";
import { searchAmazonProducts } from "@/lib/amazon-search-scraper";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const BYPASS_AUTH = true; // Bypass authentication for local testing

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

    // Scrape product data with Amazon Scraper or Firecrawl
    let productData;
    if (isAmazon) {
      const { data: existingProd } = await supabase.from('products').select('pincode').eq('user_id', user.id).eq('url', url).maybeSingle();
      const pincode = existingProd?.pincode || undefined;

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

    // Check if product exists to determine if it's an update
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id, current_price")
      .eq("user_id", user.id)
      .eq("url", url)
      .single();

    const isUpdate = !!existingProduct;

    const updateData: any = {
      user_id: user.id,
      url,
      name: productData.productName,
      current_price: newPrice,
      currency: currency,
      image_url: productData.productImageUrl,
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

    // Upsert product (insert or update based on user_id + url)
    const { data: product, error } = await supabase
      .from("products")
      .upsert(
        updateData,
        {
          onConflict: "user_id,url", // Unique constraint on user_id + url
          ignoreDuplicates: false, // Always update if exists
        }
      )
      .select()
      .single();

    if (error) throw error;

    // Always add to price history to log that a manual check occurred
    await supabase.from("price_history").insert({
      product_id: product.id,
      price: newPrice,
      currency: currency,
    });

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
  } catch (error) {
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
     
     // Add a delay between products to prevent hitting the ScrapingAnt free tier concurrency limit
     if (i < rawUrls.length - 1) {
       await new Promise(r => setTimeout(r, 3000));
     }
  }
  
  const successes = results.filter(r => r.success).length;
  const fails = results.length - successes;
  
  if (successes === 0) {
    // If all failed, return the error of the first one
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
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

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
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get products error:", error);
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
      .from("products")
      .update({ alerts_enabled: enabled, target_discount_percent: targetDiscountPercent })
      .eq("id", productId)
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

  // Update DB with the new pincode first
  await supabase
    .from("products")
    .update({ pincode })
    .eq("id", productId)
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
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }
  
  revalidatePath("/");
  return { success: true, product };
}
