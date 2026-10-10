import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const body = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const heading = Fraunces({ subsets: ["latin"], variable: "--font-heading", display: "swap", axes: ["SOFT", "opsz"] });

export const metadata: Metadata = { title: "Aangan Enquiries", description: "Phone enquiry desk for Aangan Studio" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${body.variable} ${heading.variable}`}>
      <body className="min-h-screen font-sans text-base antialiased">{children}</body>
    </html>
  );
}
