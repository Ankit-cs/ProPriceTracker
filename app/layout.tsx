import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import "./globals.css";

export const metadata = {
  title: "Price Tracker - Never Miss a Price Drop",
  description:
    "Track product prices across e-commerce sites and get alerts on price drops",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <Header user={user} />
        {children}

        <Toaster richColors />
      </body>
    </html>
  );
}
