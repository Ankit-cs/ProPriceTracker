"use client";

import { useState, useEffect } from "react";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";
import { deleteProduct, updateProductPincode, refreshProductPrice } from "@/app/actions";
import { getTieredRecommendation } from "@/lib/ai-recommendations";
import { toast } from "sonner";
import PriceChart from "./PriceChart";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import EmailModal from "./EmailModal";
import PriceInfoCard from "./PriceInfoCard";
import { WobbleButton } from "./WobbleButton";
import {
  ExternalLink,
  Trash2,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Star,
  TrendingUp,
  Activity,
  MapPin,
  Truck,
  Store,
  Loader2,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

const formatPrice = (price: number | string | undefined, currencyCode: string) => {
  if (price === undefined || price === null) return '';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return '';
  let code = currencyCode || 'INR';
  if (code === '₹' || code === 'â¹') code = 'INR';
  if (code.length !== 3) code = 'INR';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0
    }).format(numPrice);
  } catch (e) {
    return `${currencyCode} ${numPrice}`;
  }
};

export default function ProductCard({ product }) {
  const [showChart, setShowChart] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [pincode, setPincode] = useState(product.pincode || "");
  const [updatingPincode, setUpdatingPincode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ signal: 'Neutral', sentiment: { score: 0, label: 'Neutral' } });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshProductPrice(product.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Product price refreshed successfully!");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to refresh product");
    } finally {
      setRefreshing(false);
    }
  };
  
  const { livePrice, flashColor } = useRealtimePrice(product.id, product.current_price);

  useEffect(() => {
    import("@/app/signalist/actions").then((mod) => {
      mod.getSignalistStats(product.id, product.full_description || product.short_description || "").then(setStats);
    });
  }, [product.id, product.full_description, product.short_description]);

  const renderDescription = (desc: string | any) => {
    if (!desc) return null;
    let content = desc;
    try {
      if (typeof desc === 'string') {
         // Attempt to parse JSON stringified arrays/objects
         content = JSON.parse(desc);
      }
    } catch(e) {} // If it fails, it's just a normal string

    if (Array.isArray(content)) {
      return (
        <ul className="list-disc list-outside ml-4 space-y-1.5">
          {content.map((item, i) => (
            <li key={i}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
          ))}
        </ul>
      );
    }
    
    if (typeof content === 'object' && content !== null) {
       // Fallback for generic objects
       return <pre className="whitespace-pre-wrap text-[10px]">{JSON.stringify(content, null, 2)}</pre>;
    }
    
    // Normal string rendering
    return <div className="whitespace-pre-wrap">{String(content).replace(/\\n/g, '\n')}</div>;
  };

  const handleUpdatePincode = async () => {
    if (!pincode) {
      toast.error("Please enter a pincode");
      return;
    }
    setUpdatingPincode(true);
    const result = await updateProductPincode(product.id, product.url, pincode);
    setUpdatingPincode(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Delivery details updated successfully!");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove this product from tracking?")) return;

    setDeleting(true);
    await deleteProduct(product.id);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex gap-4">
          {product.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="w-20 h-20 object-cover rounded-md border"
            />
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-lg text-ink line-clamp-2 mb-2" title={product.name}>
              {product.name}
            </h3>

            {/* Rating, Reviews, ASIN & Badges */}
            {(product.rating > 0 || product.amazon_id) && (
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {product.rating > 0 && (
                  <>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-bold text-ink">{product.rating}</span>
                    </div>
                    <span className="text-xs text-ink-soft">
                      ({product.reviews_count?.toLocaleString()} reviews)
                    </span>
                    {product.reviews_count > 0 && (
                      <span className="text-[11px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200/50 font-medium">
                        Score: {parseFloat((product.rating * product.reviews_count).toFixed(1)).toLocaleString()}
                      </span>
                    )}
                  </>
                )}
                {product.amazon_id && (
                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200 font-mono uppercase">
                    ASIN: {product.amazon_id}
                  </span>
                )}
                {product.is_amazon_choice && (
                  <Badge variant="default" className="bg-indigo-900 hover:bg-indigo-900 text-[10px] text-white px-2 py-0.5 rounded border-none leading-none h-fit">
                    Choice
                  </Badge>
                )}
                
                {stats.signal === 'Strong Buy' && (
                  <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[10px] px-2 py-0.5 rounded border border-green-500/20 h-fit gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Strong Buy
                  </Badge>
                )}
                {stats.signal === 'Wait' && (
                  <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] px-2 py-0.5 rounded border border-red-500/20 h-fit gap-1">
                    <TrendingDown className="w-3 h-3" />
                    Wait
                  </Badge>
                )}
                {stats.sentiment.label !== 'Neutral' && (
                  <Badge className={`text-[10px] px-2 py-0.5 rounded h-fit gap-1 ${stats.sentiment.label === 'Bullish' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'} border`}>
                    <Activity className="w-3 h-3" />
                    {stats.sentiment.label}
                  </Badge>
                )}
                {(() => {
                  const rec = getTieredRecommendation(
                    livePrice,
                    product.average_price ? parseFloat(product.average_price) : livePrice,
                    product.lowest_price ? parseFloat(product.lowest_price) : livePrice,
                    product.discount_rate ? parseFloat(product.discount_rate) : 0
                  );
                  return (
                    <Badge className={`text-[10px] px-2 py-0.5 rounded h-fit gap-1 ${
                      rec.type === 'excellent' || rec.type === 'good'
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : rec.type === 'decent' || rec.type === 'moderate'
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        : 'bg-red-500/10 text-red-600 border-red-500/20'
                    } border font-semibold`}>
                      {rec.message}
                    </Badge>
                  );
                })()}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                {product.is_in_stock === false ? (
                  <Badge variant="destructive" className="font-semibold text-sm">
                    Out of Stock
                  </Badge>
                ) : (
                  <>
                    <span 
                      className={`text-2xl font-bold transition-colors duration-300 ${
                        flashColor === 'green' ? 'text-green-500 bg-green-500/10 px-1 rounded' 
                        : flashColor === 'red' ? 'text-red-500 bg-red-500/10 px-1 rounded' 
                        : 'text-foreground'
                      }`}
                    >
                      {formatPrice(livePrice, product.currency)}
                    </span>
                    
                    {product.original_price > livePrice && (
                      <span className="text-sm text-ink-muted line-through font-normal">
                        {formatPrice(product.original_price, product.currency)}
                      </span>
                    )}

                    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 hover:bg-green-100 border-none font-medium text-xs py-0.5">
                      <TrendingDown className="w-3 h-3" />
                      Tracking
                    </Badge>
                  </>
                )}
              </div>

              {product.original_price > livePrice && (
                <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
                  Save {formatPrice(product.original_price - livePrice, product.currency)} ({Math.round(((product.original_price - livePrice) / product.original_price) * 100)}% off)
                </div>
              )}

              {/* Aggregates Dashboard - Replaced with PriceInfoCards */}
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-2">
                <PriceInfoCard 
                  title="Lowest" 
                  icon={TrendingDown} 
                  value={formatPrice(product.lowest_price || livePrice, product.currency)} 
                  borderColorClass="border-green-500"
                  iconColorClass="text-green-500"
                />
                <PriceInfoCard 
                  title="Average" 
                  icon={Activity} 
                  value={formatPrice(product.average_price || livePrice, product.currency)} 
                  borderColorClass="border-blue-500"
                  iconColorClass="text-blue-500"
                />
                <PriceInfoCard 
                  title="Highest" 
                  icon={TrendingUp} 
                  value={formatPrice(product.highest_price || livePrice, product.currency)} 
                  borderColorClass="border-red-500"
                  iconColorClass="text-red-500"
                />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className="gap-1"
          >
            {showChart ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide Chart
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show Chart
              </>
            )}
          </Button>

          {(product.short_description || product.full_description) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFeatures(!showFeatures)}
              className="gap-1"
            >
              {showFeatures ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide Info
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Product Info
                </>
              )}
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => window.open(product.url, '_blank')}
            className="bg-accent text-white hover:bg-accent/90"
          >
            Buy Now
          </Button>

          <WobbleButton 
            title="View Details" 
            type="sm" 
            onClick={() => window.open(product.url, '_blank')}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || refreshing}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </Button>

          <div className="ml-auto flex gap-2">
            <EmailModal productId={product.id} productName={product.name} />
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={deleting || refreshing}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 hover:border-indigo-300 gap-1"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {showFeatures && (product.short_description || product.full_description) && (
          <div className="mt-4 pt-4 border-t border-line/60 text-xs text-ink-soft space-y-4">
            {product.short_description && (
              <div>
                <h4 className="font-bold text-ink mb-1.5 uppercase tracking-wider text-[10px]">About this item</h4>
                <div className="leading-relaxed pl-2.5 border-l-2 border-accent/30 text-neutral-600 max-h-40 overflow-y-auto pr-1">
                  {renderDescription(product.short_description)}
                </div>
              </div>
            )}
            {product.full_description && (
              <div>
                <h4 className="font-bold text-ink mb-1.5 uppercase tracking-wider text-[10px]">Product Description</h4>
                <div className="leading-relaxed pl-2.5 border-l-2 border-indigo-200 text-neutral-600 max-h-40 overflow-y-auto pr-1">
                  {renderDescription(product.full_description)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {showChart && (
        <CardFooter className="pt-0 flex flex-col items-stretch gap-4">
          <PriceChart productId={product.id} initialAlertsEnabled={product.alerts_enabled} initialTargetDiscount={product.target_discount_percent} />
          
          <div className="bg-surface-2 rounded-xl p-4 mt-2 border border-line">
            <h4 className="font-semibold text-sm text-ink mb-3 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-accent" />
              Delivery & Seller Details
            </h4>
            
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <MapPin className="absolute left-2.5 top-2.5 w-4 h-4 text-ink-muted" />
                <input 
                  type="text" 
                  placeholder="Enter Pincode" 
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full bg-background border border-line rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <Button size="sm" onClick={handleUpdatePincode} disabled={updatingPincode} className="gap-1 bg-ink text-background hover:bg-ink/90">
                {updatingPincode ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Fetch
              </Button>
            </div>
            
            <div className="space-y-2 text-sm text-ink-soft bg-background/50 p-3 rounded-lg border border-line/50">
              <div className="flex items-start gap-2">
                <Truck className="w-4 h-4 mt-0.5 text-ink-muted shrink-0" />
                <div>
                  <span className="font-medium text-ink">Delivery:</span>{" "}
                  {product.delivery_date ? (
                    <span>{product.delivery_date}</span>
                  ) : (
                    <span className="text-ink-muted italic">Not fetched yet</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Store className="w-4 h-4 mt-0.5 text-ink-muted shrink-0" />
                <div>
                  <span className="font-medium text-ink">Sold By:</span>{" "}
                  {product.sold_by ? (
                    <span>{product.sold_by}</span>
                  ) : (
                    <span className="text-ink-muted italic">Not fetched yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
