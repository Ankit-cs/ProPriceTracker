"use client";

import { useState } from "react";
import { signOut } from "@/app/actions";
import AuthModal from "./AuthModal";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut } from "lucide-react";

export default function AuthButton({ user }) {
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (user) {
    return (
      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-surface-2 text-ink text-[13px] font-medium hover:bg-surface-3 transition-all border border-line/60 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </form>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowAuthModal(true)}
        className="inline-flex items-center gap-1.5 h-9 pl-3.5 pr-1.5 rounded-full bg-ink text-background text-[13px] font-medium hover:bg-ink/90 transition-all ml-1 cursor-pointer"
      >
        Sign In
        <span className="grid h-7 w-7 place-items-center rounded-full bg-background/15">
          <LogIn className="w-3.5 h-3.5" />
        </span>
      </button>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
