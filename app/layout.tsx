import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Aangan Enquiries", description: "Phone enquiry agent dashboard for Aangan Studio" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen font-sans text-base antialiased">{children}</body>
    </html>
  );
}
