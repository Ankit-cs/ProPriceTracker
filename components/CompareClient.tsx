"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { searchAmazon, addProduct } from "@/app/actions";
import AuthModal from "./AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Loader2, 
  Star, 
  Download, 
  ExternalLink, 
  TrendingDown, 
  Plus, 
  Check, 
  Info,
  Terminal,
  ShoppingBag
} from "lucide-react";
import { toast } from "sonner";

export default function CompareClient({ user }) {
  const [keyword, setKeyword] = useState("");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [trackingProductIds, setTrackingProductIds] = useState<Record<string, boolean>>({});
  const [addingProductUrl, setAddingProductUrl] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const simulateScrapeProgress = (targetLimit: number) => {
    setProgress(0);
    setLogs([]);
    
    const messages = [
      "Initializing ScrapingAnt proxy client...",
      "Setting proxy region to India (IN)...",
      `Targeting Amazon India: https://www.amazon.in/s?k=${encodeURIComponent(keyword)}`,
      "Securing clean connection & rotating residential proxies...",
      "Bypassing Amazon anti-bot shields...",
      "Scraping search results page...",
      "Analyzing HTML content and mapping DOM nodes...",
    ];

    let currentLogIndex = 0;
    
    // Initial logs setup
    const logInterval = setInterval(() => {
      if (currentLogIndex < messages.length) {
        setLogs(prev => [...prev, `[system] ${messages[currentLogIndex]}`]);
        setProgress(prev => Math.min(prev + 5, 30));
        currentLogIndex++;
      } else {
        clearInterval(logInterval);
      }
    }, 800);

    // Simulate individual product checks
    let productIndex = 1;
    const productInterval = setInterval(() => {
      if (productIndex <= targetLimit) {
        setLogs(prev => [...prev, `[scraper] Parsing product ${productIndex} of ${targetLimit}...`]);
        setProgress(prev => {
          const step = Math.floor(60 / targetLimit);
          return Math.min(prev + step, 90);
        });
        productIndex++;
      } else {
        clearInterval(productInterval);
      }
    }, Math.max(200, 3000 / targetLimit));

    return { logInterval, productInterval };
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!keyword.trim()) {
      toast.error("Please enter a search keyword");
      return;
    }

    setLoading(true);
    setResults([]);
    const { logInterval, productInterval } = simulateScrapeProgress(limit);

    try {
      const response = await searchAmazon(keyword, limit);

      clearInterval(logInterval);
      clearInterval(productInterval);

      if (response.error) {
        setLogs(prev => [...prev, `[error] Scrape failed: ${response.error}`]);
        toast.error(response.error);
        setProgress(0);
      } else if (response.results) {
        setLogs(prev => [
          ...prev, 
          `[system] Scrape completed! Retrieved ${response.results.length} products successfully.`,
          `[system] Compiling results & calculating discount thresholds...`
        ]);
        setProgress(100);
        setResults(response.results);
        toast.success(`Found ${response.results.length} products on Amazon.in!`);
      }
    } catch (err: any) {
      clearInterval(logInterval);
      clearInterval(productInterval);
      setLogs(prev => [...prev, `[error] Scrape failed with exception: ${err.message}`]);
      toast.error(err.message || "Failed to search Amazon");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleTrackProduct = async (product: any) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setAddingProductUrl(product.url);
    const formData = new FormData();
    formData.append("url", product.url);

    try {
      const result = await addProduct(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message || "Now tracking product prices!");
        setTrackingProductIds(prev => ({ ...prev, [product.amazonId]: true }));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add product");
    } finally {
      setAddingProductUrl(null);
    }
  };

  const downloadCSV = () => {
    if (results.length === 0) return;

    // Headers matching the CSV schema in amazon_scraper
    const headers = [
      "title",
      "price",
      "savings",
      "rating",
      "reviews-count",
      "url",
      "is-sponsored",
      "is-amazon-choice",
      "is-discounted",
      "before-discount",
      "amazon-id",
      "thumbnail"
    ];

    const rows = results.map(p => [
      `"${p.title.replace(/"/g, '""')}"`,
      p.currentPrice,
      p.savings,
      p.rating,
      p.reviewsCount,
      `"${p.url}"`,
      p.isSponsored,
      p.isAmazonChoice,
      p.isDiscounted,
      p.originalPrice,
      `"${p.amazonId}"`,
      `"${p.thumbnail}"`
    ]);

    const csvContent = 
      "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `amazon_scraped_${keyword.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen bg-background text-ink relative overflow-x-hidden pt-24 pb-12">
      {/* Aurora Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full blur-3xl opacity-40" style={{ background: "radial-gradient(closest-side, oklch(0.85 0.09 55 / 0.55), transparent 70%)" }}></div>
        <div className="absolute bottom-[-30%] right-[-10%] h-[70vh] w-[70vh] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(closest-side, oklch(0.9 0.05 80 / 0.6), transparent 70%)" }}></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        {/* Page Title */}
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-3 border-accent/30 text-accent bg-accent/5">
            Powered by ScrapingAnt
          </Badge>
          <h1 className="text-4xl font-bold font-display text-ink mb-3 tracking-tight">
            Amazon Keyword Scraper
          </h1>
          <p className="text-base text-ink-soft max-w-xl mx-auto">
            Search and scrape Amazon India products using residential proxies. Track discounts, compare scores, and export files.
          </p>
        </div>

        {/* Search Panel Card */}
        <Card className="max-w-3xl mx-auto border-line bg-surface/80 backdrop-blur-md mb-8">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <Input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Enter keyword to search (e.g. keyboard, iPhone, coffee marker)..."
                    className="h-12 text-base rounded-full pl-11 pr-5 bg-white/70 border-line text-ink placeholder:text-ink-muted focus-visible:ring-accent"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center gap-2 min-w-[150px]">
                  <label htmlFor="limit" className="text-xs font-semibold text-ink-soft shrink-0">Items:</label>
                  <select
                    id="limit"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-between rounded-full border border-line bg-white/70 px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-ink cursor-pointer"
                  >
                    <option value={5}>5 Products</option>
                    <option value={10}>10 Products</option>
                    <option value={15}>15 Products</option>
                    <option value={20}>20 Products</option>
                    <option value={30}>30 Products</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-ink-muted bg-surface-2 px-3.5 py-1.5 rounded-full border border-line">
                  <Info className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Configured specifically for <strong>Amazon India (amazon.in)</strong> with rotated proxy servers.</span>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-ink hover:bg-ink/90 text-background h-12 px-8 rounded-full font-medium transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 w-full sm:w-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      Search & Scrape
                    </>
                  )}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Progress & Console Panel */}
        {loading || logs.length > 0 ? (
          <div className="max-w-3xl mx-auto mb-8">
            <div className="bg-ink/95 border border-line rounded-xl overflow-hidden shadow-2xl">
              {/* Terminal Header */}
              <div className="flex items-center justify-between bg-surface-3/15 px-4 py-2 border-b border-line/60">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-accent" />
                  <span className="font-mono text-xs font-semibold text-ink-soft">Amazon Scraping Terminal</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                </div>
              </div>

              {/* Progress meter */}
              <div className="p-4 border-b border-line/40 bg-ink/30">
                <div className="flex justify-between items-center text-xs font-mono text-ink-soft mb-1.5">
                  <span>Scraping progress:</span>
                  <span className="font-bold text-accent">{progress}%</span>
                </div>
                <div className="w-full bg-surface-3/30 h-2.5 rounded-full overflow-hidden border border-line/20">
                  <div 
                    className="bg-gradient-to-r from-accent to-ink-soft h-full rounded-full transition-all duration-500" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                
                {/* Simulated CLI Progress bar representation */}
                <div className="mt-3 font-mono text-[11px] text-green-400 bg-black/40 p-2 rounded border border-line/10 leading-relaxed overflow-x-auto">
                  Amazon Scraping: {keyword || "None"} | 
                  {(() => {
                    const blockCount = Math.floor(progress / 10);
                    return "█".repeat(blockCount) + "░".repeat(10 - blockCount);
                  })()} 
                  | {progress}% - {results.length > 0 ? results.length : Math.round((progress / 100) * limit)}/{limit} Products
                </div>
              </div>

              {/* Terminal logs list */}
              <div className="p-4 font-mono text-[11px] leading-relaxed text-ink-muted h-48 overflow-y-auto flex flex-col gap-1">
                {logs.map((log, index) => {
                  let colorClass = "text-ink-muted";
                  if (log.startsWith("[error]")) colorClass = "text-red-400";
                  if (log.startsWith("[scraper]")) colorClass = "text-accent";
                  if (log.includes("completed")) colorClass = "text-green-400 font-bold";

                  return (
                    <div key={index} className={`flex items-start gap-1.5 ${colorClass}`}>
                      <span className="text-accent shrink-0">&gt;</span>
                      <span>{log.replace(/^\[(system|scraper|error)\]\s*/, "")}</span>
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        ) : null}

        {/* Search Results Display */}
        {results.length > 0 && (
          <section className="mt-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold font-display text-ink">
                  Scraped Results
                </h2>
                <p className="text-sm text-ink-muted">
                  Showing {results.length} items parsed from amazon.in search
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  size="default"
                  onClick={downloadCSV}
                  className="gap-2 rounded-full cursor-pointer h-10 px-5 bg-surface border border-line text-ink font-semibold text-xs hover:bg-surface-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </Button>
              </div>
            </div>

            {/* Grid of Results */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((product) => {
                const isTracked = trackingProductIds[product.amazonId];
                
                return (
                  <Card key={product.amazonId} className="hover:shadow-md transition-shadow relative overflow-hidden flex flex-col h-full bg-surface border-line">
                    
                    {/* Sponsored badge */}
                    {product.isSponsored && (
                      <span className="absolute top-2 right-2 bg-black/60 text-white font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full z-10 backdrop-blur-sm">
                        Sponsored
                      </span>
                    )}

                    <div className="p-4 flex gap-4 items-start flex-1">
                      {product.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.thumbnail}
                          alt={product.title}
                          className="w-20 h-20 object-contain bg-white rounded-lg border border-line/60 shrink-0 p-1"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-ink line-clamp-2 leading-snug mb-1" title={product.title}>
                          {product.title}
                        </h3>

                        {/* Rating */}
                        {product.rating > 0 && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="flex items-center gap-0.5 text-yellow-500">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              <span className="text-xs font-bold text-ink-soft">{product.rating}</span>
                            </div>
                            <span className="text-[11px] text-ink-muted">
                              ({product.reviewsCount.toLocaleString()})
                            </span>
                            {product.isAmazonChoice && (
                              <Badge variant="default" className="bg-indigo-900 text-[10px] text-white px-2 py-0.5 rounded border-none leading-none">
                                Choice
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Pricing */}
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <span className="text-base font-bold text-ink">
                            {new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: 'INR',
                              maximumFractionDigits: 0
                            }).format(product.currentPrice)}
                          </span>

                          {product.isDiscounted && (
                            <>
                              <span className="text-xs text-ink-muted line-through">
                                {new Intl.NumberFormat('en-IN', {
                                  style: 'currency',
                                  currency: 'INR',
                                  maximumFractionDigits: 0
                                }).format(product.originalPrice)}
                              </span>
                              <span className="text-xs font-bold text-green-600">
                                -{Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100)}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-surface-2 border-t border-line flex gap-2 justify-end">
                      <Button variant="outline" size="sm" asChild className="h-8 text-[11px] font-semibold gap-1.5 rounded-full">
                        <a href={product.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3" />
                          View on Amazon
                        </a>
                      </Button>

                      <Button
                        variant={isTracked ? "secondary" : "default"}
                        size="sm"
                        disabled={isTracked || addingProductUrl === product.url}
                        onClick={() => handleTrackProduct(product)}
                        className={`h-8 text-[11px] font-semibold gap-1.5 rounded-full cursor-pointer transition-all ${
                          isTracked 
                            ? "bg-green-100 text-green-700 hover:bg-green-100 border-none font-bold" 
                            : "bg-ink text-background hover:bg-ink/90"
                        }`}
                      >
                        {addingProductUrl === product.url ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Tracking...
                          </>
                        ) : isTracked ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-700" />
                            Tracking
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            Track Price
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </main>
  );
}
