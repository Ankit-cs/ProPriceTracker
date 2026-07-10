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
      <body className="antialiased font-sans">
        <Header user={user} />
        {children}

        <Toaster richColors />
        <Analytics />
      </body>
    </html>
  );
}
