import { Suspense } from "react";
import { HealthStrip } from "@/components/HealthStrip";
import { Brand, Nav } from "@/components/Sidebar";
import { actionQueue } from "@/lib/queries";

export const dynamic = "force-dynamic";

async function reviewCount(): Promise<number> {
  try {
    return (await actionQueue("live")).length;
  } catch {
    return 0; // the page itself shows the database error
  }
}

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const count = await reviewCount();
  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2">Skip to content</a>

      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-6">
          <Brand />
        </div>
        <div className="px-3 pb-3 lg:flex-1 lg:px-4">
          <Nav reviewCount={count} />
        </div>
        <div className="hidden space-y-4 border-t border-line px-5 py-5 lg:block">
          <Suspense fallback={<p className="text-xs text-fg-3">Checking system health…</p>}>
            <HealthStrip vertical />
          </Suspense>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
