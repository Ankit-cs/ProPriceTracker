"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Search, Tag, BarChart2, Calendar, LayoutDashboard } from "lucide-react";

export default function SearchCmdk() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-start justify-center pt-[20vh] px-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <Command className="w-full bg-transparent flex flex-col h-full" label="Global Command Menu" shouldFilter={true}>
          <div className="flex items-center border-b border-line px-4">
            <Search className="w-5 h-5 text-ink-muted mr-2 shrink-0" />
            <Command.Input 
              autoFocus
              className="flex-1 bg-transparent border-0 py-4 outline-none text-ink placeholder:text-ink-muted focus:ring-0" 
              placeholder="Search features or jump to..." 
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-ink-soft">No results found.</Command.Empty>
            
            <Command.Group heading="Features" className="text-xs font-medium text-ink-muted px-2 py-1.5 mb-1">
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/"))}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-ink/5 hover:text-ink rounded-lg cursor-pointer aria-selected:bg-ink/5 aria-selected:text-ink"
              >
                <LayoutDashboard className="w-4 h-4 text-ink-soft" /> Dashboard
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/compare"))}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-ink/5 hover:text-ink rounded-lg cursor-pointer aria-selected:bg-ink/5 aria-selected:text-ink"
              >
                <BarChart2 className="w-4 h-4 text-ink-soft" /> Compare Products
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/price-drops"))}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-ink/5 hover:text-ink rounded-lg cursor-pointer aria-selected:bg-ink/5 aria-selected:text-ink"
              >
                <Tag className="w-4 h-4 text-ink-soft" /> Price Drops
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/sales-calendar"))}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-ink/5 hover:text-ink rounded-lg cursor-pointer aria-selected:bg-ink/5 aria-selected:text-ink"
              >
                <Calendar className="w-4 h-4 text-ink-soft" /> Sales Calendar & Predictor
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
