"use client";

import { useState } from "react";
import { addMultipleProducts, addProduct } from "@/app/actions";
import AuthModal from "./AuthModal";
import { Loader2, Search, Link2, PlusCircle } from "lucide-react";
import { toast } from "sonner";

export default function AddProductForm({ user }) {
  const [mode, setMode] = useState<"url" | "search">("url");
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("urls", url);

    const result = await addMultipleProducts(formData);

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.info(result.message || "Scraping queued! Please wait...", { duration: 5000 });
      if (result.job_ids && result.job_ids.length > 0) {
        // Poll the first job ID to show overall progress (simplified for UI)
        pollJobStatus(result.job_ids[0]);
      } else {
        toast.success("Products tracked successfully!");
        setUrl("");
        setLoading(false);
      }
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();
      
      if (data.status === "completed") {
        toast.success("Product scraped and tracked successfully!");
        setLoading(false);
        setUrl("");
      } else if (data.status === "failed") {
        toast.error(data.error_message || "Failed to scrape product");
        setLoading(false);
      } else {
        // pending or running
        setTimeout(() => pollJobStatus(jobId), 2000);
      }
    } catch (err) {
      toast.error("Error checking job status");
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setSearchResults(data.results || []);
      }
    } catch (err) {
      toast.error("Failed to fetch search results");
    } finally {
      setSearching(false);
    }
  };

  const handleTrackSearchResult = async (productLink: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("url", productLink);
      const result = await addProduct(formData);
      if (result.error) {
        toast.error(result.error);
        setLoading(false);
      } else {
        toast.info(result.message || "Scraping queued...");
        if (result.job_id) {
          pollJobStatus(result.job_id);
        } else {
          toast.success("Product tracked successfully!");
          setLoading(false);
        }
      }
    } catch (err) {
      toast.error("An error occurred while tracking the product");
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-2xl mx-auto mb-6">
        {/* Toggle Mode buttons */}
        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={async () => {
              setMode("url");
              try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                  const text = await navigator.clipboard.readText();
                  // Basic check if it looks like a URL
                  if (text && (text.includes("http://") || text.includes("https://"))) {
                    setUrl((prev) => {
                      if (!prev) return text;
                      if (!prev.includes(text)) return prev + "\n" + text;
                      return prev;
                    });
                  }
                }
              } catch (err) {
                console.error("Failed to read clipboard", err);
              }
            }}
            className={`px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2 transition-all ${
              mode === "url"
                ? "bg-ink text-background shadow-md"
                : "bg-white/50 border border-line text-ink-muted hover:text-ink"
            }`}
          >
            <Link2 className="h-4 w-4" />
            Paste URLs
          </button>
          <button
            onClick={() => setMode("search")}
            className={`px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2 transition-all ${
              mode === "search"
                ? "bg-ink text-background shadow-md"
                : "bg-white/50 border border-line text-ink-muted hover:text-ink"
            }`}
          >
            <Search className="h-4 w-4" />
            Search Products
          </button>
        </div>

        {mode === "url" ? (
          <form onSubmit={handleSubmit} className="w-full">
            <div className="flex flex-col gap-3">
              <textarea
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste product URLs (separate multiple URLs with commas or new lines)"
                className="w-full min-h-[80px] p-4 text-base rounded-2xl bg-white/70 border border-line text-ink placeholder:text-ink-muted focus-visible:ring-accent focus:outline-none focus:ring-2"
                required
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading}
                className="bg-ink hover:bg-ink/90 text-background h-12 px-8 rounded-full font-medium transition-colors inline-flex items-center justify-center cursor-pointer shrink-0 self-end"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  "Track Price(s)"
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="w-full flex flex-col gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name (e.g. Sony WH-1000XM4)"
                className="flex-1 px-4 h-12 rounded-full bg-white/70 border border-line text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                required
                disabled={searching}
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-ink hover:bg-ink/90 text-background h-12 px-6 rounded-full font-medium transition-colors inline-flex items-center justify-center cursor-pointer"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-line p-4 max-h-[300px] overflow-y-auto flex flex-col gap-3 shadow-lg">
                {searchResults.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-black/5 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.thumbnail && (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-contain bg-white border border-line shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate max-w-md">
                          {item.title}
                        </p>
                        <p className="text-xs font-semibold text-accent">
                          {item.price || "Check site"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTrackSearchResult(item.product_link)}
                      disabled={loading}
                      className="bg-ink hover:bg-ink/90 text-background px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Track
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
