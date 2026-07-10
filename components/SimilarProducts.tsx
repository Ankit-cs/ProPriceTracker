"use client";

import { useEffect, useState } from "react";
import { getSimilarProducts } from "@/app/actions";
import { Badge } from "@/components/ui/badge";

export default function SimilarProducts({ excludeProductId, currency }) {
  const [similar, setSimilar] = useState<any[]>([]);

  useEffect(() => {
    getSimilarProducts(excludeProductId).then(setSimilar);
  }, [excludeProductId]);

  if (similar.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-line/60">
      <h4 className="font-bold text-ink mb-3 uppercase tracking-wider text-[10px]">Alternative Deals</h4>
      <div className="flex flex-col gap-2">
        {similar.map((prod) => (
          <a
            key={prod.id}
            href={prod.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/40 border border-line/50 hover:bg-black/5 transition-all text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              {prod.image_url && (
                <img
                  src={prod.image_url}
                  alt={prod.name}
                  className="w-8 h-8 rounded object-contain bg-white border shrink-0"
                />
              )}
              <span className="truncate font-medium text-ink max-w-[150px]">{prod.name}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-ink">
                {currency} {parseFloat(prod.current_price).toLocaleString()}
              </span>
              {prod.discount_rate > 0 && (
                <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1 py-0.5 rounded border border-green-200">
                  -{Math.round(prod.discount_rate)}%
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
