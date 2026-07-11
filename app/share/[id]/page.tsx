import { createClient } from "@supabase/supabase-js";
import { Zap, Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SharedWishlistPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: portfolio, error } = await supabase
    .from("portfolios")
    .select(`
      id, 
      name, 
      created_at,
      portfolio_items (
        product_id,
        products (
          id, name, current_price, image_url, url
        )
      )
    `)
    .eq("id", params.id)
    .single();

  if (error || !portfolio) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex items-center justify-center min-h-[50vh] pt-24">
        <div className="text-center">
          <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-ink">Setup not found</h1>
          <p className="text-muted-foreground mt-2">This Dream Setup may have been deleted or doesn't exist.</p>
        </div>
      </div>
    );
  }

  const items = portfolio.portfolio_items || [];
  const totalCost = items.reduce((sum, item) => sum + ((item.products as any)?.current_price || 0), 0);

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-5xl pt-24">
      <div className="text-center space-y-2 border-b border-line/40 pb-8">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-surface-2 border border-line/60 rounded-2xl flex items-center justify-center shadow-sm">
            <Zap className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-ink">{portfolio.name}</h1>
        <p className="text-muted-foreground text-lg">A shared Dream Setup wishlist via Buy Karle</p>
        <div className="mt-6 inline-flex items-center gap-2 bg-ink text-background px-6 py-2.5 rounded-full font-bold text-xl shadow-lg hover:scale-105 transition-transform cursor-default">
          Total Value: ₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-surface-2 rounded-2xl border border-line/40 border-dashed">
            This setup is currently empty.
          </div>
        ) : (
          items.map((item) => {
            const product = item.products as any;
            if (!product) return null;
            return (
              <a 
                href={product.url} 
                target="_blank" 
                rel="noreferrer" 
                key={product.id}
                className="group relative flex flex-col bg-surface-1 border border-line/60 rounded-xl overflow-hidden hover:border-ink/20 transition-all hover:shadow-xl hover:-translate-y-1"
              >
                <div className="aspect-square w-full relative bg-white flex items-center justify-center p-4">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <Package className="w-12 h-12 text-muted-foreground/30" />
                  )}
                </div>
                <div className="p-4 flex flex-col gap-2 bg-surface-2/30 flex-1 border-t border-line/30">
                  <h3 className="font-medium text-sm line-clamp-2 leading-tight text-ink group-hover:text-blue-500 transition-colors">{product.name}</h3>
                  <div className="mt-auto pt-2">
                    <span className="font-bold text-lg text-ink">₹{product.current_price?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
