"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AuthModal({ isOpen, onClose }) {
  const supabase = createClient();
  const [lastUsed, setLastUsed] = useState("");

  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLastUsed(localStorage.getItem("lastUsedLogin") || "");
      setShowEmailInput(false);
      setMessage("");
      setEmail("");
    }
  }, [isOpen]);

  const handleGoogleLogin = async () => {
    localStorage.setItem("lastUsedLogin", "google");
    const { origin } = window.location;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setMessage("");
    localStorage.setItem("lastUsedLogin", "email");
    
    const { origin } = window.location;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for the login link!");
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>
            Track product prices and get alerts on price drops
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {!showEmailInput ? (
            <>
              <Button
                onClick={handleGoogleLogin}
                variant="outline"
                className="w-full gap-2 relative"
                size="lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
                {lastUsed === "google" && (
                  <span className="absolute right-3 bg-accent/20 text-accent text-xs font-semibold px-2 py-0.5 rounded-full">
                    Last Used
                  </span>
                )}
              </Button>

              <Button
                onClick={() => setShowEmailInput(true)}
                variant="outline"
                className="w-full gap-2 relative"
                size="lg"
              >
                <Mail className="w-5 h-5 text-ink-muted" />
                Continue with Email
                {lastUsed === "email" && (
                  <span className="absolute right-3 bg-accent/20 text-accent text-xs font-semibold px-2 py-0.5 rounded-full">
                    Last Used
                  </span>
                )}
              </Button>
            </>
          ) : (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-line bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                />
              </div>
              
              {message && (
                <div className={`text-sm ${message.includes("error") || message.includes("invalid") ? "text-red-500" : "text-green-600"}`}>
                  {message}
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowEmailInput(false);
                    setMessage("");
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-ink text-background hover:bg-ink/90"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Magic Link"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
