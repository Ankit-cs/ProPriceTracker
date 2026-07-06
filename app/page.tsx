import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getProducts } from "./actions";
import AddProductForm from "@/components/AddProductForm";
import ProductCard from "@/components/ProductCard";
import { TrendingDown, Shield, Bell, Rabbit } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import Image from "next/image";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const products = user ? await getProducts() : [];

  const FEATURES = [
    
    {
      icon: Rabbit,
      title: "Lightning Fast",
      description:
        "Buy Karle extracts prices in seconds, handling JavaScript and dynamic content",
    },
    {
      icon: Shield,
      title: "Always Reliable",
      description:
        "Works across all major e-commerce sites with built-in anti-bot protection",
    },
    {
      icon: Bell,
      title: "Smart Alerts",
      description: "Get notified instantly when prices drop below your target",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-ink relative overflow-x-hidden pt-24 pb-12">
      {/* Aurora Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full blur-3xl opacity-40" style={{ background: "radial-gradient(closest-side, oklch(0.85 0.09 55 / 0.55), transparent 70%)" }}></div>
        <div className="absolute bottom-[-30%] right-[-10%] h-[70vh] w-[70vh] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(closest-side, oklch(0.9 0.05 80 / 0.6), transparent 70%)" }}></div>
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-[0.25] mix-blend-multiply" style={{ backgroundImage: "radial-gradient(oklch(0.5 0.02 70 / 0.08) 1px, transparent 1px)", backgroundSize: "3px 3px" }}></div>

      {/* Floating Header */}
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

      {/* Hero Section */}
      <section className="py-12 px-4 relative z-10">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-5xl font-bold font-display text-ink mb-4 tracking-tight">
            Save Now Buy Later
          </h2>
          <p className="text-xl text-ink-soft mb-12 max-w-2xl mx-auto">
            Track prices from any e-commerce site. Get instant alerts when
            prices drop. Save money effortlessly.
          </p>

          <AddProductForm user={user} />

          {/* Features */}
          {products.length === 0 && (
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="bg-surface p-6 rounded-xl border border-line"
                >
                  <div className="w-12 h-12 bg-accent/15 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-ink mb-2">{title}</h3>
                  <p className="text-sm text-ink-soft">{description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Products Grid */}
      {user && products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-20 relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold font-display text-ink">
              Your Tracked Products
            </h3>
            <span className="text-sm text-ink-muted">
              {products.length} {products.length === 1 ? "product" : "products"}
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2 items-start">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {user && products.length === 0 && (
        <section className="max-w-2xl mx-auto px-4 pb-20 text-center relative z-10">
          <div className="bg-surface rounded-xl border-2 border-dashed border-line p-12">
            <TrendingDown className="w-16 h-16 text-ink-muted mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-ink mb-2">
              No products yet
            </h3>
            <p className="text-ink-soft">
              Add your first product above to start tracking prices!
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
