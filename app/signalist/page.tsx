import React from "react";
import { getPortfolios, createPortfolio, deletePortfolio } from "./actions";
import { getProducts, getPriceHistory } from "@/app/actions";
import PortfolioCard from "@/components/Signalist/PortfolioCard";
import { calculateVolatility, calculateMovingAverage, getSignal } from "@/lib/signalist-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, BarChart3, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SignalistPage() {
  const portfolios = await getPortfolios();
  const products = await getProducts();
  
  // Get all price histories to calculate market movers
  const marketMovers = await Promise.all(
    products.slice(0, 5).map(async (p: any) => {
      const history = await getPriceHistory(p.id);
      const volatility = calculateVolatility(history);
      const ma = calculateMovingAverage(history);
      const signal = getSignal(p.current_price, ma);
      
      return { ...p, volatility, signal };
    })
  );

  // Sort by volatility descending
  marketMovers.sort((a, b) => b.volatility - a.volatility);

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-8 w-8 text-yellow-500" />
          Dream Setup
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Stock-market inspired analytics for your e-commerce setups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Portfolios Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Your Dream Setups</h2>
            <form action={async (formData) => {
              "use server";
              const name = formData.get("name") as string;
              if (name) await createPortfolio(name);
            }} className="flex gap-2">
              <input 
                name="name" 
                type="text" 
                placeholder="New Setup Name..." 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                required 
              />
              <button type="submit" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                Create
              </button>
            </form>
          </div>
          
          {portfolios.length === 0 ? (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">You don't have any setups yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Create one to track the total cost of a group of products.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {portfolios.map((p: any) => (
                <PortfolioCard 
                  key={p.id} 
                  portfolio={p} 
                  allProducts={products}
                  onDelete={async (id) => {
                    "use server";
                    await deletePortfolio(id);
                  }}
                />
              ))}
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
