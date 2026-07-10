import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getProducts, getMockUser } from "@/app/actions";
import CompareClient from "./CompareClient";

export default async function ComparePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let user: any = await getMockUser();
  if (!user) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    user = authUser;
  }

  const products = user ? await getProducts() : [];

  return (
    <main className="min-h-screen bg-background text-ink relative pt-24 pb-12 overflow-hidden">
      {/* Aurora Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-[-10%] h-[60vh] w-[60vh] rounded-full blur-3xl opacity-20" style={{ background: "radial-gradient(closest-side, oklch(0.85 0.09 55 / 0.55), transparent 70%)" }}></div>
        <div className="absolute bottom-[-20%] left-[-10%] h-[70vh] w-[70vh] rounded-full blur-3xl opacity-20" style={{ background: "radial-gradient(closest-side, oklch(0.9 0.05 80 / 0.6), transparent 70%)" }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold font-display text-ink mb-4 tracking-tight">Compare Products</h1>
          <p className="text-ink-soft text-lg">Select up to 3 products from your tracking list to compare prices, ratings, and features side-by-side.</p>
        </div>

        <CompareClient allProducts={products} user={user} />
      </div>
    </main>
  );
}
