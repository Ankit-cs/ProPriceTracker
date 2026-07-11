import React from "react";
import { getProducts, getPriceHistory } from "@/app/actions";
import { Bot } from "lucide-react";
import AIAssistantClient from "./AIAssistantClient";

export const dynamic = "force-dynamic";

// Helper to group price history into Weekly OHLC
function buildOHLCData(history: any[]) {
  if (!history || history.length === 0) return [];
  
  const groupedByWeek: Record<string, any[]> = {};
  
  history.forEach(point => {
      const date = new Date(point.checked_at || point.created_at || Date.now());
      const year = date.getFullYear();
      const week = Math.ceil((date.getDate() - date.getDay() + 1) / 7);
      const weekKey = `${year}-W${week}`;
      
      if (!groupedByWeek[weekKey]) {
          groupedByWeek[weekKey] = [];
      }
      groupedByWeek[weekKey].push(point.price);
  });

  const ohlcData = Object.keys(groupedByWeek).map(week => {
      const prices = groupedByWeek[week];
      const open = prices[0];
      const close = prices[prices.length - 1];
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      
      return {
          date: week,
          open,
          high,
          low,
          close,
          openClose: [open, close]
      };
  });

  const windowSize = 3;
  return ohlcData.map((data, index, arr) => {
      if (index < windowSize - 1) {
          return { ...data, ma: data.close };
      }
      const slice = arr.slice(index - windowSize + 1, index + 1);
      const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
      const ma = sum / windowSize;
      return { ...data, ma };
  });
}

export default async function AIAssistantPage() {
  const products = await getProducts();
  
  // Pre-calculate analysis for all products so the client can query instantly
  const analyzedProducts = await Promise.all(
    products.map(async (p: any) => {
      const history = await getPriceHistory(p.id) || [];
      const ohlc = buildOHLCData(history);
      
      const currentPrice = p.current_price;
      const ma = ohlc.length > 0 ? ohlc[ohlc.length - 1].ma : currentPrice;
      
      let signal = "Wait";
      let signalColor = "bg-yellow-500/10 text-yellow-500";
      
      if (currentPrice < ma * 0.95) {
          signal = "Buy Now";
          signalColor = "bg-green-500/10 text-green-500";
      } else if (currentPrice > ma * 1.05) {
          signal = "Overpriced";
          signalColor = "bg-red-500/10 text-red-500";
      }

      return { ...p, signal, signalColor, ma };
    })
  );

  return (
    <div className="container mx-auto p-4 md:p-8 animate-in fade-in zoom-in-95 duration-500 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-8 w-8 text-primary" />
          AI Assistant Chat
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Ask questions and get deep-learning insights on your tracked products.
        </p>
      </div>

      <div className="bg-background border-2 rounded-2xl overflow-hidden shadow-sm">
          <AIAssistantClient products={analyzedProducts} />
      </div>
    </div>
  );
}
