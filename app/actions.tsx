"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { scrapeProduct } from "@/lib/firecrawl";
import { scrapeAmazonProduct } from "@/lib/amazon-scraper";
import { searchAmazonProducts } from "@/lib/amazon-search-scraper";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addProduct(formData) {
  const url = formData.get("url");

  if (!url) {
    return { error: "URL is required" };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Scrape product data with Amazon Scraper or Firecrawl
    let productData;
    if (url.includes("amazon.")) {
      productData = await scrapeAmazonProduct(url);
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

export async function deleteProduct(productId) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
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
    const supabase = createClient(cookieStore);
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
    const supabase = createClient(cookieStore);
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
    const supabase = createClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

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
    
    const { sendPriceDropAlert } = await import("@/lib/email");
    
    const result = await sendPriceDropAlert(
      user.email,
      product,
      oldPrice,
      newPrice
    );

    if (result.error) throw new Error(result.error);
    return { success: true };
  } catch (error) {
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
    const supabase = createClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

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

