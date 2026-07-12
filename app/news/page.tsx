import React from "react";
import { Construction } from "lucide-react";

export default function NewsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-ink/5 p-6 rounded-full mb-6">
        <Construction className="h-12 w-12 text-ink-soft" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-ink mb-3">Work in Progress</h1>
      <p className="text-lg text-ink-muted max-w-md mx-auto">
        We're working hard to bring you the News feature. Please check back soon!
      </p>
    </div>
  );
}
