import Link from "next/link";
import { Suspense } from "react";
import { HealthStrip } from "@/components/HealthStrip";

export const dynamic = "force-dynamic";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 py-4">
        <nav className="flex items-center gap-5 text-sm">
          <span className="font-semibold">Aangan · Enquiries</span>
          <Link href="/" className="text-stone-600 hover:text-stone-900">Overview</Link>
          <Link href="/calls" className="text-stone-600 hover:text-stone-900">Calls</Link>
        </nav>
        <div className="flex items-center gap-5">
          <Suspense fallback={<span className="text-xs text-stone-400">Checking health…</span>}>
            <HealthStrip />
          </Suspense>
          <form method="post" action="/api/logout">
            <button className="text-xs text-stone-500 hover:text-stone-900">Log out</button>
          </form>
        </div>
      </header>
      <main className="pt-6">{children}</main>
    </div>
  );
}
