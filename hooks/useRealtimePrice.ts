"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function useRealtimePrice(productId: string, initialPrice: number | string) {
  const [livePrice, setLivePrice] = useState<number>(Number(initialPrice));
  const [flashColor, setFlashColor] = useState<'green' | 'red' | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`product-${productId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${productId}`
        },
        (payload) => {
          const newPrice = Number(payload.new.current_price);
          
          setLivePrice((prevPrice) => {
            if (newPrice !== prevPrice) {
              setFlashColor(newPrice < prevPrice ? 'green' : 'red');
              
              // Clear flash after 2 seconds
              setTimeout(() => {
                setFlashColor(null);
              }, 2000);
            }
            return newPrice;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId]);

  return { livePrice, flashColor };
}
