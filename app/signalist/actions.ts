"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getMockUser, isBypassAuthEnabled } from "@/app/actions";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { calculateMovingAverage, calculateVolatility, getSignal, analyzeSentiment } from "@/lib/signalist-utils";

const getServiceRoleClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function getPortfolios() {
  try {
    const bypassAuth = await isBypassAuthEnabled();
    const cookieStore = await cookies();
    const supabase = bypassAuth ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (bypassAuth) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) return [];

    const { data, error } = await supabase
      .from("portfolios")
      .select(`
        id, 
        name, 
        created_at,
        portfolio_items (
          product_id,
          products (
            id, name, current_price, image_url
          )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get portfolios error:", error);
    return [];
  }
}

export async function createPortfolio(name: string) {
  try {
    const bypassAuth = await isBypassAuthEnabled();
    const cookieStore = await cookies();
    const supabase = bypassAuth ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (bypassAuth) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) return { error: "Not authenticated" };

    const { data, error } = await supabase
      .from("portfolios")
      .insert({ user_id: user.id, name })
      .select()
      .single();

    if (error) throw error;
    
    revalidatePath("/signalist");
    return { success: true, portfolio: data };
  } catch (error: any) {
    console.error("Create portfolio error:", error);
    return { error: error.message };
  }
}

export async function addPortfolioItem(portfolioId: string, productId: string) {
  try {
    const bypassAuth = await isBypassAuthEnabled();
    const cookieStore = await cookies();
    const supabase = bypassAuth ? getServiceRoleClient() : createClient(cookieStore);

    const { error } = await supabase
      .from("portfolio_items")
      .insert({ portfolio_id: portfolioId, product_id: productId });

    if (error) throw error;
    
    revalidatePath("/signalist");
    return { success: true };
  } catch (error: any) {
    console.error("Add portfolio item error:", error);
    return { error: error.message };
  }
}

export async function deletePortfolio(id: string) {
  try {
    const bypassAuth = await isBypassAuthEnabled();
    const cookieStore = await cookies();
    const supabase = bypassAuth ? getServiceRoleClient() : createClient(cookieStore);

    const { error } = await supabase
      .from("portfolios")
      .delete()
      .eq("id", id);

    if (error) throw error;
    
    revalidatePath("/signalist");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deletePortfolioItem(portfolioId: string, productId: string) {
  try {
    const bypassAuth = await isBypassAuthEnabled();
    const cookieStore = await cookies();
    const supabase = bypassAuth ? getServiceRoleClient() : createClient(cookieStore);

    const { error } = await supabase
      .from("portfolio_items")
      .delete()
      .match({ portfolio_id: portfolioId, product_id: productId });

    if (error) throw error;
    
    revalidatePath("/signalist");
    return { success: true };
  } catch (error: any) {
    console.error("Delete portfolio item error:", error);
    return { error: error.message };
  }
}

export async function addURLToPortfolio(portfolioId: string, formData: FormData) {
  try {
    const { addProduct } = await import("@/app/actions");
    const result = await addProduct(formData);
    
    if (result.error) {
      return { error: result.error };
    }
    
    if (result.product && result.product.id) {
      return await addPortfolioItem(portfolioId, result.product.id);
    }
    
    return { error: "Failed to create product from URL" };
  } catch (error: any) {
    console.error("Add URL to portfolio error:", error);
    return { error: error.message };
  }
}

export async function getSignalistStats(productId: string, description: string) {
  try {
    const bypassAuth = await isBypassAuthEnabled();
    const cookieStore = await cookies();
    const supabase = bypassAuth ? getServiceRoleClient() : createClient(cookieStore);

    const { data: history } = await supabase
      .from("price_history")
      .select("price")
      .eq("product_id", productId)
      .order("checked_at", { ascending: true });

    const ma = calculateMovingAverage(history || []);
    
    // Get current price from latest history
    const currentPrice = history && history.length > 0 ? history[history.length - 1].price : 0;
    
    const signal = getSignal(currentPrice, ma);
    const sentiment = analyzeSentiment(description || "");

    return { signal, sentiment };
  } catch (error) {
    console.error("Stats error:", error);
    return { signal: 'Neutral', sentiment: { score: 0, label: 'Neutral' } };
  }
}
