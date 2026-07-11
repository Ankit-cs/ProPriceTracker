"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Link, Loader2, MinusCircle, Share2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { addPortfolioItem, addURLToPortfolio, deletePortfolioItem } from "@/app/signalist/actions";
import { toast } from "sonner";

export default function PortfolioCard({ 
  portfolio, 
  allProducts,
  onDelete 
}: { 
  portfolio: any,
  allProducts?: any[],
  onDelete: (id: string) => void 
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [items, setItems] = useState(portfolio.portfolio_items || []);
  const [flashColor, setFlashColor] = useState<'green' | 'red' | null>(null);

  // Sync items from server props (fast updates without refresh)
  useEffect(() => {
    setItems(portfolio.portfolio_items || []);
  }, [portfolio.portfolio_items]);

  useEffect(() => {
    const supabase = createClient();
    
    // We listen to ANY product update. If the product is in our portfolio, we update its price.
    const channel = supabase
      .channel(`portfolio-${portfolio.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          const newPrice = Number(payload.new.current_price);
          const productId = payload.new.id;
          
          setItems((currentItems: any[]) => {
            let updated = false;
            let didPriceChange = false;
            let priceDropped = false;

            const newItems = currentItems.map(item => {
              if (item.product_id === productId) {
                const oldPrice = Number(item.products?.current_price || 0);
                if (oldPrice !== newPrice) {
                  didPriceChange = true;
                  priceDropped = newPrice < oldPrice;
                }
                updated = true;
                return {
                  ...item,
                  products: {
                    ...item.products,
                    current_price: newPrice
                  }
                };
              }
              return item;
            });
            
            if (updated && didPriceChange) {
              setFlashColor(priceDropped ? 'green' : 'red');
              setTimeout(() => setFlashColor(null), 2000);
            }
            
            return updated ? newItems : currentItems;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [portfolio.id]);
  
  const totalValue = items.reduce((acc: number, item: any) => {
    return acc + Number(item.products?.current_price || 0);
  }, 0);

  return (
    <Card className="w-full relative overflow-hidden transition-all hover:shadow-md border-border/40">
      <div className="absolute top-0 right-0 p-4 flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-blue-500 transition-colors"
          onClick={() => {
            const url = `${window.location.origin}/share/${portfolio.id}`;
            navigator.clipboard.writeText(url);
            toast.success("Share link copied!");
          }}
          title="Share Wishlist"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-destructive transition-colors"
          onClick={async () => {
            setIsDeleting(true);
            await onDelete(portfolio.id);
            setIsDeleting(false);
          }}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-tight">{portfolio.name}</CardTitle>
        <CardDescription>
          {items.length} {items.length === 1 ? 'Product' : 'Products'} in setup
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 mb-4">
          <span 
            className={`text-4xl font-extrabold tracking-tighter transition-colors duration-300 ${
              flashColor === 'green' ? 'text-green-500 bg-green-500/10 px-2 rounded' 
              : flashColor === 'red' ? 'text-red-500 bg-red-500/10 px-2 rounded' 
              : ''
            }`}
          >
            ₹{totalValue.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground pb-1 font-medium uppercase tracking-wider">
            Total Value
          </span>
        </div>
        
        <div className="space-y-2 mt-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No products added yet.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2">
              {items.map((item: any) => (
                <div key={item.product_id} className="flex items-center justify-between text-sm group">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {item.products?.image_url && (
                      <img src={item.products.image_url} alt="" className="w-6 h-6 object-cover rounded" />
                    )}
                    <span className="truncate flex-1 max-w-[180px]" title={item.products?.name}>
                      {item.products?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="font-semibold whitespace-nowrap">
                      ₹{Number(item.products?.current_price).toFixed(2)}
                    </span>
                    <button 
                      className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={async () => {
                        // Optimistic UI update
                        setItems((prev: any[]) => prev.filter((i) => i.product_id !== item.product_id));
                        await deletePortfolioItem(portfolio.id, item.product_id);
                      }}
                      title="Remove from setup"
                    >
                      <MinusCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex flex-col gap-3">
        {allProducts && allProducts.length > 0 && (
          <form action={async (formData) => {
            const productId = formData.get("product_id") as string;
            if (productId) {
              setIsAdding(true);
              await addPortfolioItem(portfolio.id, productId);
              setIsAdding(false);
            }
          }} className="flex w-full gap-2">
            <select 
              name="product_id" 
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="" disabled selected>Select tracked product...</option>
              {allProducts.filter(p => !items.find((i:any) => i.product_id === p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Button type="submit" variant="default" size="sm" disabled={isAdding} className="shrink-0 h-9">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </form>
        )}
        
        <form action={async (formData) => {
          const url = formData.get("url") as string;
          if (url) {
            setIsAdding(true);
            await addURLToPortfolio(portfolio.id, formData);
            setIsAdding(false);
          }
        }} className="flex w-full gap-2 relative">
          <Link className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            name="url"
            type="url"
            placeholder="Paste Amazon link..."
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button type="submit" size="sm" disabled={isAdding} variant="secondary" className="shrink-0 h-9">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
