"use client";

import { useState, useMemo } from "react";
import { addSiteReview } from "@/app/actions";
import { Star, Loader2, FilterX } from "lucide-react";
import { toast } from "sonner";
import AuthModal from "./AuthModal";

export default function SiteReviews({ user, initialReviews }: { user: any, initialReviews: any[] }) {
  const [reviews, setReviews] = useState(initialReviews || []);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [filterRating, setFilterRating] = useState(null);

  const stats = useMemo(() => {
    const total = reviews.length;
    const average = total > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1) : 0;
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      if (dist[r.rating] !== undefined) dist[r.rating]++;
    });
    return { total, average, dist };
  }, [reviews]);

  const displayedReviews = filterRating 
    ? reviews.filter(r => r.rating === filterRating) 
    : reviews;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    if (!content.trim()) {
      toast.error("Please enter a review");
      return;
    }

    setLoading(true);
    const result = await addSiteReview(rating, content);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Review submitted successfully!");
      const userName = user.user_metadata?.full_name || user.user_metadata?.name || null;
      const userAvatar = user.user_metadata?.avatar_url || null;
      const userEmail = user.email ? (user.email.includes("@") ? user.email.split("@")[0][0] + "***@" + user.email.split("@")[1] : "You") : "You";
      
      setReviews([{ ...result.review, author: userName || userEmail, avatar_url: userAvatar }, ...reviews]);
      setRating(0);
      setContent("");
      setFilterRating(null);
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <h3 className="text-3xl font-bold font-display text-ink mb-2">Testimonials</h3>
        <p className="text-ink-soft">Real reviews from people saving money with Buy Karle</p>
      </div>

      <div className="grid md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Chart */}
        <div className="md:col-span-4 flex flex-col gap-6">
          {/* Chart Summary */}
          <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl font-bold text-ink">{stats.average}</div>
              <div className="flex flex-col">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star} 
                      className={`w-4 h-4 ${star <= Math.round(Number(stats.average)) ? "fill-yellow-400 text-yellow-400" : "text-line"}`} 
                    />
                  ))}
                </div>
                <span className="text-xs text-ink-muted mt-1">{stats.total} global ratings</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {[5, 4, 3, 2, 1].map(star => {
                const count = stats.dist[star];
                const percent = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const isSelected = filterRating === star;
                
                return (
                  <button 
                    key={star}
                    onClick={() => setFilterRating(isSelected ? null : star)}
                    className={`flex items-center gap-3 w-full group cursor-pointer transition-colors p-1 -mx-1 rounded-md ${isSelected ? 'bg-accent/5' : 'hover:bg-background'}`}
                  >
                    <div className="flex items-center gap-1 text-sm font-medium text-ink-muted group-hover:text-ink w-12 shrink-0">
                      {star} <Star className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 h-2.5 bg-line/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-accent' : 'bg-yellow-400'}`} 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="text-xs font-medium text-ink-muted w-8 text-right">
                      {percent}%
                    </div>
                  </button>
                );
              })}
            </div>
            
            {filterRating && (
              <button 
                onClick={() => setFilterRating(null)}
                className="mt-4 flex items-center justify-center gap-1.5 w-full text-xs font-medium text-ink hover:text-accent transition-colors py-1.5 bg-background rounded-lg border border-line"
              >
                <FilterX className="w-3.5 h-3.5" />
                Clear Filter ({filterRating} Stars)
              </button>
            )}
          </div>

          {/* Form */}
          {user && (
            <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm">
              <h4 className="text-xl font-semibold text-ink mb-4">Leave a Review</h4>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <div className="flex gap-1 justify-center mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 focus:outline-none cursor-pointer hover:scale-110 transition-transform"
                      >
                        <Star 
                          className={`w-8 h-8 transition-colors ${
                            (hoverRating || rating) >= star 
                              ? "fill-yellow-400 text-yellow-400" 
                              : "text-line hover:text-yellow-200"
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="How much have you saved using this tool?"
                    className="w-full min-h-[120px] p-3 text-sm rounded-xl bg-background border border-line text-ink placeholder:text-ink-muted focus-visible:ring-accent focus:outline-none focus:ring-2 resize-none"
                    disabled={loading}
                    maxLength={500}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-ink hover:bg-ink/90 text-background h-11 rounded-xl font-medium transition-colors flex items-center justify-center cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Review"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Review List */}
        <div className="md:col-span-8 flex flex-col gap-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
          {displayedReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-8 bg-surface/50 rounded-2xl border border-dashed border-line">
              <Star className="w-10 h-10 text-ink-muted mb-3" />
              <p className="text-ink-soft">
                {filterRating ? `No ${filterRating}-star reviews yet.` : "No reviews yet. Be the first to share your experience!"}
              </p>
            </div>
          ) : (
            displayedReviews.map((review: any) => (
              <div key={review.id} className="bg-surface p-5 rounded-2xl border border-line shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm overflow-hidden">
                      {review.avatar_url ? (
                        <img src={review.avatar_url} alt={review.author} className="w-full h-full object-cover" />
                      ) : (
                        review.author ? review.author[0].toUpperCase() : "A"
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-sm text-ink block leading-none mb-1">{review.author}</span>
                      <p className="text-xs text-ink-muted">
                        {new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 bg-background px-2 py-1 rounded-full border border-line">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star 
                        key={star} 
                        className={`w-3.5 h-3.5 ${star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-line"}`} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">{review.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
