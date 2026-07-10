"use client";

import { useState } from "react";
import { deleteProduct } from "@/app/actions";
import PriceChart from "./PriceChart";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Trash2,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Star,
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
  const [deleting, setDeleting] = useState(false);

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
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-bold text-foreground">
                  {formatPrice(product.current_price, product.currency)}
                </span>
                
                {product.original_price > product.current_price && (
                  <span className="text-sm text-ink-muted line-through font-normal">
                    {formatPrice(product.original_price, product.currency)}
                  </span>
                )}

                <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 hover:bg-green-100 border-none font-medium text-xs py-0.5">
                  <TrendingDown className="w-3 h-3" />
                  Tracking
                </Badge>
              </div>

              {product.original_price > product.current_price && (
                <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
                  Save {formatPrice(product.original_price - product.current_price, product.currency)} ({Math.round(((product.original_price - product.current_price) / product.original_price) * 100)}% off)
                </div>
              )}
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

          <Button variant="outline" size="sm" asChild className="gap-1">
            <Link href={product.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              View Product
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </Button>
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
        <CardFooter className="pt-0">
          <PriceChart productId={product.id} initialAlertsEnabled={product.alerts_enabled} initialTargetDiscount={product.target_discount_percent} />
        </CardFooter>
      )}
    </Card>
  );
}
