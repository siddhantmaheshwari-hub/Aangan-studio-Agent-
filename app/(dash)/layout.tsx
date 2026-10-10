import Link from "next/link";
import { Suspense } from "react";
import { HealthStrip } from "@/components/HealthStrip";

export const dynamic = "force-dynamic";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-surface focus:p-2">Skip to content</a>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <span className="mr-3 font-semibold">Aangan · Enquiries</span>
          <Link href="/" className="rounded px-2 py-2 text-fg-2 hover:bg-surface-2 hover:text-fg">Overview</Link>
          <Link href="/calls" className="rounded px-2 py-2 text-fg-2 hover:bg-surface-2 hover:text-fg">All calls</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Suspense fallback={<span className="text-xs text-fg-3">Checking system health…</span>}>
            <HealthStrip />
          </Suspense>
          <form method="post" action="/api/logout">
            <button className="rounded px-2 py-2 text-xs text-fg-3 hover:bg-surface-2 hover:text-fg">Log out</button>
          </form>
        </div>
      </header>
      <main id="main" className="pt-6">{children}</main>
    </div>
  );
}
