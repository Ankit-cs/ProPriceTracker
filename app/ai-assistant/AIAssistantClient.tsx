"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, TrendingUp, TrendingDown, Clock, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AIAssistantClient({ products }: { products: any[] }) {
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [analyzedProduct, setAnalyzedProduct] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = () => {
    if (!selectedProduct) return;
    
    setIsLoading(true);
    
    // Simulate AI thinking delay for better UX
    setTimeout(() => {
        setAnalyzedProduct(selectedProduct);
        setIsLoading(false);
    }, 600);
  };

  return (
    <div className="flex flex-col h-[80vh]">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {!analyzedProduct && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
                <Bot className="h-16 w-16 text-muted-foreground" />
                <p className="text-xl font-medium">Select a tracked product to get AI insights.</p>
            </div>
        )}

        {analyzedProduct && (
            <Card className="overflow-hidden border-2 transition-all border-primary/50 animate-in fade-in slide-in-from-bottom-4">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{analyzedProduct.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <span className="font-semibold text-foreground">Current: ₹{analyzedProduct.current_price}</span>
                      <span>•</span>
                      <span>Average: ₹{Math.round(analyzedProduct.ma)}</span>
                    </CardDescription>
                  </div>
                  <Badge className={analyzedProduct.signalColor} variant="outline">
                    {analyzedProduct.signal === "Buy Now" && <TrendingDown className="mr-1 h-3 w-3" />}
                    {analyzedProduct.signal === "Overpriced" && <TrendingUp className="mr-1 h-3 w-3" />}
                    {analyzedProduct.signal === "Wait" && <Clock className="mr-1 h-3 w-3" />}
                    {analyzedProduct.signal}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="p-4 bg-muted/50 rounded-lg text-sm flex gap-3">
                  <Zap className="h-5 w-5 text-yellow-500 shrink-0" />
                  <div className="space-y-2">
                    <p>
                      <strong>AI Insight:</strong> Based on historical price trends and moving averages, the current price of ₹{analyzedProduct.current_price} is {analyzedProduct.signal === "Buy Now" ? "significantly below the recent average. This is a great time to buy!" : analyzedProduct.signal === "Overpriced" ? "higher than usual. We recommend waiting for a drop." : "hovering around its normal average. Wait for a better deal."}
                    </p>
                    {query && (
                      <p className="text-muted-foreground italic mt-2">
                         Query context applied: "{query}"
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
        )}
      </div>

      {/* Interactive Chat Bar */}
      <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto flex gap-2 relative items-center">
            
            {/* Product Selection Dropdown via + Button */}
            <div className="relative">
                <Button 
                    variant="outline" 
                    size="icon" 
                    className="shrink-0 rounded-full"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                    <Plus className="h-5 w-5" />
                </Button>
                
                {isDropdownOpen && (
                    <div className="absolute bottom-full mb-2 left-0 w-64 bg-popover border shadow-lg rounded-xl overflow-hidden z-50">
                        <div className="p-2 border-b bg-muted/50 flex justify-between items-center">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">Your Products</span>
                            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setIsDropdownOpen(false)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        <ul className="max-h-48 overflow-y-auto p-1">
                            {products.length === 0 && <li className="p-2 text-xs text-muted-foreground">No products tracked.</li>}
                            {products.map(p => (
                                <li 
                                    key={p.id} 
                                    className="p-2 text-sm hover:bg-accent rounded-md cursor-pointer truncate"
                                    onClick={() => {
                                        setSelectedProduct(p);
                                        setIsDropdownOpen(false);
                                    }}
                                >
                                    {p.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Input Bar */}
            <div className="flex-1 flex bg-muted rounded-full items-center px-4 overflow-hidden border focus-within:ring-1 focus-within:ring-ring">
                {selectedProduct && (
                    <Badge variant="secondary" className="mr-2 shrink-0 truncate max-w-[150px]">
                        {selectedProduct.name}
                    </Badge>
                )}
                <input 
                    type="text" 
                    placeholder={selectedProduct ? "Ask a question..." : "Select a product first..."}
                    className="flex-1 h-12 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={!selectedProduct}
                    onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                />
            </div>

            {/* Ask Button */}
            <Button 
                className="shrink-0 rounded-full px-6 transition-colors"
                style={{ backgroundColor: "black", color: "white" }}
                onClick={handleAsk}
                disabled={!selectedProduct || isLoading}
              
            >
                {isLoading ? <Bot className="h-4 w-4 animate-pulse" /> : <Send />}
                Ask
            </Button>
        </div>
      </div>
    </div>
  );
}
