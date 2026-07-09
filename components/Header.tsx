"use client";

import AuthButton from "./AuthButton";

export default function Header({ user }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 pt-5">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="relative flex h-14 items-center justify-between rounded-full px-4 md:px-6 bg-background/40 border border-line/40 backdrop-blur-xl backdrop-saturate-150">
          {/* Logo */}
          <a className="flex items-center gap-2 group pr-2" href="/">
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-background font-bold text-[11px] leading-none transition-transform duration-500 group-hover:scale-110">
              BK
            </span>
            <span className="font-display text-[17px] font-bold tracking-tight leading-none text-ink">
              Buy Karle
            </span>
          </a>

          {/* Navigation links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            <a href="/deals" className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-ink-soft hover:text-ink transition-colors">
              Deals
            </a>
            <a href="/categories" className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-ink-soft hover:text-ink transition-colors">
              Categories
            </a>
            <a href="/compare" className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-ink-soft hover:text-ink transition-colors">
              Compare
            </a>
            <a href="/price-drops" className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-ink-soft hover:text-ink transition-colors">
              Price Drops
            </a>
            <a href="/sales-calendar" className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-ink-soft hover:text-ink transition-colors">
              Sales Calendar
            </a>
            <a href="/news" className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-ink-soft hover:text-ink transition-colors">
              News
            </a>
            <a href="/ai-assistant" className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-medium text-ink-soft hover:text-ink transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
                <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path>
                <path d="M20 2v4"></path>
                <path d="M22 4h-4"></path>
                <circle cx="4" cy="20" r="2"></circle>
              </svg>
              AI Assistant
            </a>
          </nav>

          {/* Right Buttons */}
          <div className="flex items-center gap-2">
            <button aria-label="Search" className="hidden md:flex items-center gap-2 h-9 pl-3 pr-2 rounded-full text-[12.5px] text-ink-muted hover:text-ink transition-all border border-line/60 hover:border-ink/30 hover:bg-surface-2/60 cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21 21-4.34-4.34"></path>
                <circle cx="11" cy="11" r="8"></circle>
              </svg>
              <span>Search</span>
              <kbd className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-3 text-ink-soft">⌘K</kbd>
            </button>
            <AuthButton user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
