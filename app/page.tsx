import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getProducts, getMockUser } from "./actions";
import AddProductForm from "@/components/AddProductForm";
import ProductCard from "@/components/ProductCard";
import HeroCarousel from "@/components/HeroCarousel";
import { TrendingDown, Shield, Bell, Rabbit } from "lucide-react";
import Image from "next/image";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let user: any = await getMockUser();
  if (!user) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  }

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

          <HeroCarousel products={products} />

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
            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-muted">
                {products.length} {products.length === 1 ? "product" : "products"}
              </span>
              <a href="/api/products/export?format=pdf" className="text-sm font-medium text-accent hover:underline px-3 py-1 bg-surface border border-line rounded-md">
                Export PDF
              </a>
            </div>
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
