import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getProducts, getMockUser } from "@/app/actions";
import ProductCard from "@/components/ProductCard";
import SimilarProducts from "@/components/SimilarProducts";
import { TrendingDown, Filter } from "lucide-react";

export default async function PriceDropsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let user: any = await getMockUser();
  if (!user) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    user = authUser;
  }

  let products = user ? await getProducts() : [];
  
  // Filter only products that are currently discounted
  products = products.filter(p => {
    const currentPrice = Number(p.current_price) || 0;
    const originalPrice = Number(p.original_price) || currentPrice;
    return p.is_discounted || currentPrice < originalPrice;
  });
  
  // Sort by highest discount percentage
  products.sort((a, b) => {
    const discountA = a.original_price > 0 ? (a.original_price - a.current_price) / a.original_price : 0;
    const discountB = b.original_price > 0 ? (b.original_price - b.current_price) / b.original_price : 0;
    return discountB - discountA;
  });

  return (
    <main className="min-h-screen bg-background text-ink relative pt-24 pb-12 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <TrendingDown className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-4xl font-bold font-display text-ink mb-4 tracking-tight">Biggest Price Drops</h1>
          <p className="text-ink-soft text-lg">We filtered your tracking list to show only items that are currently on sale. Ordered by biggest discount.</p>
        </div>

        {products.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-2xl font-bold font-display text-ink">Active Sales</h3>
               <span className="text-sm font-medium bg-accent/10 text-accent px-3 py-1 rounded-full flex items-center gap-2">
                 <Filter className="w-3 h-3" /> {products.length} discounted {products.length === 1 ? 'item' : 'items'}
               </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 items-start">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20 px-4 bg-surface rounded-2xl border border-dashed border-line">
            <h3 className="text-xl font-semibold mb-2">No Active Discounts</h3>
            <p className="text-ink-soft max-w-sm mx-auto">None of your tracked products are currently on sale. We will email you the moment prices drop!</p>
          </div>
        )}

        {/* Global Alternative Deals Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <div className="bg-surface rounded-2xl border border-line p-6 shadow-md">
            <h3 className="text-lg font-bold font-display text-ink mb-1">🔥 Top Trending Deals</h3>
            <p className="text-xs text-ink-soft mb-4">Discover discounted alternative products tracked globally by the Buy Karle community.</p>
            <SimilarProducts excludeProductId="" currency="₹" />
          </div>
        </div>
      </div>
    </main>
  );
}
