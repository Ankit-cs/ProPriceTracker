"use client";

import { useState, useRef } from "react";
import { signOut } from "@/app/actions";
import { uploadAvatar } from "@/app/actions";
import AuthModal from "./AuthModal";
import { LogIn, LogOut, Upload, User as UserIcon, Edit2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthButton({ user }) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default avatar taken from the user's email using DiceBear initials API, overridden by uploaded avatar_url if present
  const avatarUrl = user?.user_metadata?.avatar_url || (user?.email ? `https://api.dicebear.com/9.x/initials/svg?seed=${user.email}` : null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadAvatar(formData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Avatar updated!");
    }
    setIsUploading(false);
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative group w-9 h-9 rounded-full overflow-hidden border border-line/60 bg-surface-2 flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-4 h-4 text-ink-soft" />
          )}
          {/* Edit button overlays on hover */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
            title="Edit Avatar"
          >
            <Edit2 className="w-4 h-4 text-white" />
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleUpload} 
          className="hidden" 
          accept="image/*"
        />
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-surface-2 text-ink text-[13px] font-medium hover:bg-surface-3 transition-all border border-line/60 cursor-pointer disabled:opacity-50"
            disabled={isUploading}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </form>
      </div>
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
