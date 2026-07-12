import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata = {
  title: "Price Tracker - Never Miss a Price Drop",
  description:
    "Track product prices across e-commerce sites and get alerts on price drops",
};

import { getMockUser, isBypassAuthEnabled } from "@/app/actions";

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const bypass = await isBypassAuthEnabled();
  let user;
  if (bypass) {
    user = await getMockUser();
  } else {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  }

  return (
    <html lang="en">
      <body className="antialiased font-sans bg-background text-ink relative min-h-screen">
        {/* Global Aurora Background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <div className="absolute -top-1/3 left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full blur-3xl opacity-40" style={{ background: "radial-gradient(closest-side, oklch(0.85 0.09 55 / 0.55), transparent 70%)" }}></div>
          <div className="absolute bottom-[-30%] right-[-10%] h-[70vh] w-[70vh] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(closest-side, oklch(0.9 0.05 80 / 0.6), transparent 70%)" }}></div>
        </div>
        <div className="pointer-events-none fixed inset-0 opacity-[0.25] mix-blend-multiply -z-10" style={{ backgroundImage: "radial-gradient(oklch(0.5 0.02 70 / 0.08) 1px, transparent 1px)", backgroundSize: "3px 3px" }}></div>
        
        <Header user={user} />
        {children}

        <Toaster richColors />
        <Analytics />
      </body>
    </html>
  );
}
