"use client";

import { useState } from "react";
import { addMultipleProducts } from "@/app/actions";
import AuthModal from "./AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AddProductForm({ user }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
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
    } else {
      toast.success(result.message || "Product tracked successfully!");
      setUrl("");
    }

    setLoading(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
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
                Processing...
              </>
            ) : (
              "Track Price(s)"
            )}
          </button>
        </div>
      </form>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
