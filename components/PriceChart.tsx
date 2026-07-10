"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getPriceHistory, toggleAlerts } from "@/app/actions";
import { Loader2, Bell, AlertTriangle, TrendingDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNextUpcomingSale } from "@/lib/sales-events";
import { toast } from "sonner";

export default function PriceChart({ 
  productId, 
  initialAlertsEnabled = false,
  initialTargetDiscount = 0
}: { 
  productId: string; 
  initialAlertsEnabled?: boolean;
  initialTargetDiscount?: number;
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30d");
  const [currentPrice, setCurrentPrice] = useState(0);
  const [averagePrice, setAveragePrice] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [aiVerdict, setAiVerdict] = useState({ title: "", description: "", confidence: 0, type: "neutral" });
  const [targetDiscount, setTargetDiscount] = useState(initialTargetDiscount);
  const [alertsEnabled, setAlertsEnabled] = useState(initialAlertsEnabled);
  const [togglingAlerts, setTogglingAlerts] = useState(false);

  const handleToggleAlerts = async () => {
    setTogglingAlerts(true);
    const targetState = !alertsEnabled;
    const res = await toggleAlerts(productId, targetState, targetDiscount);
    if (res.error) {
      toast.error(res.error);
    } else {
      setAlertsEnabled(targetState);
      toast.success(targetState ? (targetDiscount > 0 ? `Alerts enabled for ${targetDiscount}% drop!` : "Email alerts enabled!") : "Email alerts disabled.");
    }
    setTogglingAlerts(false);
  };

  const handleUpdateTarget = async (newVal: number) => {
    setTargetDiscount(newVal);
    if (alertsEnabled) {
      setTogglingAlerts(true);
      const res = await toggleAlerts(productId, true, newVal);
      if (!res.error) {
        toast.success(`Alert updated to ${newVal > 0 ? `${newVal}% drop` : 'any drop'}!`);
      }
      setTogglingAlerts(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      const history = await getPriceHistory(productId);

      if (history && history.length > 0) {
        // Sort history by date ascending
        const sortedHistory = history.sort(
          (a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
        );
        
        let chartData = sortedHistory.map((item) => ({
          date: new Date(item.checked_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          price: parseFloat(item.price),
          rawDate: new Date(item.checked_at),
        }));
        
        // If there's only 1 real data point, duplicate it so the area chart renders a flat line instead of nothing
        if (chartData.length === 1) {
          const fakePast = new Date(chartData[0].rawDate);
          fakePast.setDate(fakePast.getDate() - 1);
          chartData.unshift({
             date: fakePast.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
             price: chartData[0].price,
             rawDate: fakePast,
          });
        }

        // Extend the line to today if the last data point isn't today
        const lastPoint = chartData[chartData.length - 1];
        const today = new Date();
        if (lastPoint && lastPoint.rawDate.toDateString() !== today.toDateString()) {
           chartData.push({
             date: today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
             price: lastPoint.price,
             rawDate: today,
           });
        }

        setData(chartData);
        
        const latestPrice = chartData[chartData.length - 1].price;
        setCurrentPrice(latestPrice);
        
        // Calculate average and min
        const avg = chartData.reduce((acc, curr) => acc + curr.price, 0) / chartData.length;
        setAveragePrice(avg);
        
        const min = Math.min(...chartData.map(d => d.price));
        setMinPrice(min);

        // --- REAL AI VERDICT LOGIC ---
        const nextSale = getNextUpcomingSale();
        
        if (nextSale) {
          const daysUntil = Math.max(0, Math.ceil((nextSale.startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
          if (daysUntil <= 30) {
            setAiVerdict({
              title: `Wait ${daysUntil === 0 ? 'for today' : `${daysUntil} days`}.`,
              description: `Upcoming ${nextSale.name} starts soon. Historically this device receives discounts between ₹${nextSale.expectedDiscountRange[0]}–₹${nextSale.expectedDiscountRange[1]} during this period.`,
              confidence: 92,
              type: "wait"
            });
          } else {
             evaluateBasicLogic(latestPrice, avg, min);
          }
        } else {
           evaluateBasicLogic(latestPrice, avg, min);
        }
      }
      
      setLoading(false);
    }

    function evaluateBasicLogic(latest: number, avg: number, min: number) {
        if (latest <= min && latest < avg) {
            setAiVerdict({
              title: "Buy Now.",
              description: "The price is currently at the lowest we've recorded recently. Excellent time to purchase.",
              confidence: 88,
              type: "buy"
            });
        } else if (latest < avg) {
            setAiVerdict({
              title: "Good time to buy.",
              description: "Price is lower than the recent average, indicating a minor discount is active.",
              confidence: 75,
              type: "buy"
            });
        } else {
            setAiVerdict({
              title: "Wait for a drop.",
              description: "Price is currently at or above average. We recommend holding off until the next discount.",
              confidence: 85,
              type: "wait"
            });
        }
    }

    loadData();
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 w-full bg-[#f5f1ea]/30 rounded-xl mt-4">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading price intelligence...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 w-full bg-[#f5f1ea]/30 rounded-xl mt-4">
        No price history yet. Check back after the first daily update!
      </div>
    );
  }

  const priceDiff = currentPrice - averagePrice;
  const isDrop = priceDiff < 0;

  return (
    <div className="w-full mt-6 bg-[#f5f1ea]/20 rounded-xl border border-border/40 overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Timing intelligence
            </div>
            <h4 className="text-2xl font-serif text-ink tracking-tight mb-2">
              Buy today, or wait for a drop.
            </h4>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              We track every price across the internet, every hour. Then we tell you the smartest moment to click buy.
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-foreground mb-1">
               {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  maximumFractionDigits: 0
                }).format(currentPrice)}
            </div>
            {priceDiff !== 0 && (
              <div className={`text-sm font-medium flex items-center justify-end gap-1 ${isDrop ? 'text-green-600' : 'text-red-500'}`}>
                {isDrop ? '↓' : '↑'} 
                {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  maximumFractionDigits: 0
                }).format(Math.abs(priceDiff))} vs 30-day avg
              </div>
            )}
          </div>
        </div>

        {/* Time range toggles */}
        <div className="flex gap-2 mb-6">
          {['30d', '90d', '1y', 'All'].map(range => (
            <button 
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${timeRange === range ? 'bg-ink text-white' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
            >
              {range}
            </button>
          ))}
        </div>

        <div className="h-[240px] w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }} 
                stroke="#9ca3af" 
                axisLine={false} 
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                stroke="#9ca3af" 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(value) => {
                  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
                  if (value >= 1000) return `₹${(value / 1000).toFixed(1).replace('.0', '')}k`;
                  return `₹${value}`;
                }}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                }}
                itemStyle={{ color: "#fff" }}
                formatter={(value: number) => [
                  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value),
                  "Price"
                ]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#FA5D19"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorPrice)"
                dot={{ r: 4, fill: "#FA5D19", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#FA5D19", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-lg border border-border/50 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <div className="text-sm text-muted-foreground">
              Get notified when the price drops below your target.
            </div>
            <select 
              value={targetDiscount} 
              onChange={(e) => handleUpdateTarget(Number(e.target.value))}
              disabled={togglingAlerts}
              className="text-sm border border-input rounded-md px-2 py-1.5 w-fit bg-background focus:ring-1 focus:ring-accent outline-none"
            >
              <option value={0}>Any Drop</option>
              <option value={5}>5% Off</option>
              <option value={10}>10% Off</option>
              <option value={15}>15% Off</option>
              <option value={20}>20% Off</option>
              <option value={30}>30% Off</option>
              <option value={40}>40% Off</option>
              <option value={50}>50% Off</option>
            </select>
          </div>
          
          <Button 
            className={`rounded-full gap-2 shrink-0 transition-colors ${
              alertsEnabled 
                ? "bg-green-600 hover:bg-green-700 text-white border-none font-medium" 
                : ""
            }`}
            variant={alertsEnabled ? "default" : "outline"}
            size="default"
            onClick={handleToggleAlerts}
            disabled={togglingAlerts}
          >
            {togglingAlerts ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bell className={`w-4 h-4 ${alertsEnabled ? "fill-white" : ""}`} />
            )}
            {alertsEnabled ? "Alerts Enabled ✓" : "Notify me"}
          </Button>
        </div>
      </div>
    </div>
  );
}
