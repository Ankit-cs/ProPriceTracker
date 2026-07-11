"use client";

import { FormEvent, useState } from 'react';
import { toast } from "sonner";
import { Mail, Loader2, BellRing } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  productId: string;
  productName: string;
}

export default function EmailModal({ productId, productName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    
    try {
      const { addUserEmailToProduct } = await import('@/app/actions');
      const result = await addUserEmailToProduct(productId, email);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message || "Successfully subscribed to alerts!");
        setEmail('');
        setIsOpen(false);
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 border border-indigo-200">
          <BellRing className="w-3.5 h-3.5" />
          Track
        </button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 border border-indigo-200">
            <Mail className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl text-center font-bold text-neutral-900">
            Stay Updated!
          </DialogTitle>
          <DialogDescription className="text-center text-neutral-500 pt-2 pb-4">
            Get instant alerts when the price drops for:
            <br/>
            <span className="font-semibold text-neutral-700 mt-1 block line-clamp-1">{productName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative flex items-center">
            <Mail className="absolute left-3 w-5 h-5 text-neutral-400" />
            <input 
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400"
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors flex items-center justify-center disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Subscribing...
              </>
            ) : (
              "Subscribe to Alerts"
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
