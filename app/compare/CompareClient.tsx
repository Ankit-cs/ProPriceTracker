"use client";

import { useState } from "react";
import { useCompareStore } from "@/store/useCompareStore";
import { Plus, X, ArrowRight, ExternalLink, Star, Loader2 } from "lucide-react";
import Image from "next/image";
import { addProduct as addProductServerAction, getProductById } from "@/app/actions";
import { toast } from "sonner";

export default function CompareClient({ allProducts, user }) {
  const { selectedProducts, addProduct, removeProduct, clearProducts } = useCompareStore();
  const [pastedUrl, setPastedUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);

  const unselectedProducts = allProducts.filter(
    (p) => !selectedProducts.find((sp) => sp.id === p.id)
  );

  const handleCompareDirectLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedUrl.trim()) return;

    if (selectedProducts.length >= 3) {
      toast.error("You can compare up to 3 products max.");
      return;
    }

    const cleanUrl = pastedUrl.trim();
    
    // Check if already selected
    if (selectedProducts.find(p => p.url === cleanUrl)) {
      toast.error("This product is already in comparison.");
      return;
    }

    // Check if exists in tracked products list
    const existing = allProducts.find(p => p.url === cleanUrl);
    if (existing) {
      addProduct(existing);
      setPastedUrl("");
      toast.success("Added to comparison!");
      return;
    }

    setIsScraping(true);
    try {
      const formData = new FormData();
      formData.append("url", cleanUrl);
      
      const res = await addProductServerAction(formData);
      if (res.error) {
        toast.error(res.error);
        setIsScraping(false);
        return;
      }

      if (res.success && res.job_id) {
        toast.info("Scraping started... please wait.");
        
        let success = false;
        let productId = "";
        
        // Poll job status API up to 30 times (60 seconds)
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          
          const pollRes = await fetch(`/api/jobs/${res.job_id}`);
          if (!pollRes.ok) continue;
          
          const jobData = await pollRes.json();
          if (jobData.status === "completed") {
            success = true;
            productId = jobData.product_id;
            break;
          }
          if (jobData.status === "failed") {
            toast.error(jobData.error_message || "Scraping failed.");
            break;
          }
        }

        if (success && productId) {
          const detailsRes = await getProductById(productId);
          if (detailsRes.success && detailsRes.product) {
            addProduct(detailsRes.product);
            setPastedUrl("");
            toast.success("Successfully scraped & added to comparison!");
          } else {
            toast.error("Failed to retrieve scraped product details.");
          }
        } else {
          toast.error("Scraping timed out or failed.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to compare product link.");
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Selector */}
      <div className="bg-surface rounded-2xl border border-line p-6 max-w-4xl mx-auto w-full flex flex-col gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Select Products to Compare</h2>
            {selectedProducts.length > 0 && (
              <button onClick={clearProducts} className="text-sm text-ink-muted hover:text-red-500 transition-colors">
                Clear All
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-ink/5 border border-line rounded-full pl-3 pr-1 py-1">
                <span className="text-sm font-medium truncate max-w-[200px]">{p.name}</span>
                <button 
                  onClick={() => removeProduct(p.id)}
                  className="w-6 h-6 rounded-full bg-background flex items-center justify-center text-ink-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {selectedProducts.length < 3 && unselectedProducts.length > 0 && (
              <div className="relative group">
                <select 
                  className="appearance-none bg-background border border-line text-sm rounded-full pl-4 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent w-[200px] text-ink-soft cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      const product = allProducts.find(p => p.id === e.target.value);
                      if (product) addProduct(product);
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>+ Add Tracked Product</option>
                  {unselectedProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name.substring(0, 40)}...</option>
                  ))}
                </select>
                <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
              </div>
            )}
            
            {selectedProducts.length === 3 && (
              <span className="text-sm text-ink-muted flex items-center px-2">Limit reached (3 max)</span>
            )}
          </div>
        </div>

        {/* Direct Link Input */}
        <form onSubmit={handleCompareDirectLink} className="border-t border-line/60 pt-4 flex flex-col sm:flex-row gap-3">
          <input 
            type="url"
            required
            placeholder="Or paste any product URL to scrape & compare directly (Flipkart, Myntra, Amazon, etc.)..."
            className="flex-1 px-4 py-2.5 bg-background border border-line text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            disabled={isScraping}
          />
          <button 
            type="submit"
            disabled={isScraping || !pastedUrl.trim() || selectedProducts.length >= 3}
            className="px-6 py-2.5 bg-ink text-background rounded-xl text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isScraping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Compare Direct Link
              </>
            )}
          </button>
        </form>
      </div>

      {/* Comparison Table */}
      {selectedProducts.length > 0 ? (
        <div className="w-full overflow-x-auto pb-8">
          <div className="flex min-w-max gap-4 mx-auto justify-center">
            {selectedProducts.map((p) => {
              const currentPrice = Number(p.current_price) || 0;
              const originalPrice = Number(p.original_price) || currentPrice;
              const isDiscounted = p.is_discounted || currentPrice < originalPrice;
              const discountPercent = isDiscounted && originalPrice > 0 
                ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) 
                : 0;

              return (
                <div key={p.id} className="w-[320px] shrink-0 bg-surface border border-line rounded-3xl p-6 flex flex-col gap-6 relative">
                  <button 
                    onClick={() => removeProduct(p.id)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-background/50 backdrop-blur border border-line flex items-center justify-center text-ink-muted hover:text-red-500 transition-colors z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  <div className="aspect-square relative rounded-2xl overflow-hidden bg-white/50 border border-line p-4 flex items-center justify-center">
                    {p.image_url ? (
                      <Image src={p.image_url} alt="Product" fill className="object-contain p-4" unoptimized />
                    ) : (
                      <div className="w-full h-full bg-surface flex items-center justify-center text-ink-muted">No Image</div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-lg leading-tight line-clamp-2 mb-2" title={p.name}>{p.name}</h3>
                    
                    <div className="flex items-center gap-1.5 mb-4">
                      <div className="flex items-center text-yellow-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-semibold ml-1">{p.rating || "0.0"}</span>
                      </div>
                      <span className="text-sm text-ink-muted">({(p.reviews_count || 0).toLocaleString()} reviews)</span>
                    </div>

                    <div className="space-y-1 p-4 bg-background rounded-xl border border-line mb-6">
                      <div className="text-sm text-ink-soft">Current Price</div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold font-display">{p.currency || '₹'}{currentPrice.toLocaleString()}</span>
                        {isDiscounted && discountPercent > 0 && (
                          <span className="text-accent text-sm font-semibold bg-accent/10 px-2 py-0.5 rounded-md mb-1">
                            -{discountPercent}%
                          </span>
                        )}
                      </div>
                      {isDiscounted && originalPrice > 0 && (
                        <div className="text-sm text-ink-muted line-through">
                          {p.currency || '₹'}{originalPrice.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <a 
                    href={p.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-auto w-full py-3 px-4 bg-ink text-background rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-ink/90 transition-colors"
                  >
                    View on Store <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 px-4 bg-surface rounded-2xl border border-dashed border-line">
          <div className="w-16 h-16 rounded-full bg-ink/5 flex items-center justify-center mx-auto mb-4">
            <ArrowRight className="w-6 h-6 text-ink-muted" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nothing to Compare</h3>
          <p className="text-ink-soft max-w-sm mx-auto">Select a product from the dropdown above to start your side-by-side comparison.</p>
        </div>
      )}
    </div>
  );
}
