import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";



export const metadata: Metadata = {
  title: "Mudra",
  description: "A smart software to track all the goods",
};

export default function RootLayout({children,}: Readonly<{children: React.ReactNode;}>) 
  {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
