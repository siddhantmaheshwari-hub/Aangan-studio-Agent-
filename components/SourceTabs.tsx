import Link from "next/link";

/** Live calls / Fixture replays / All — a segmented control that keeps other query params. */
export function SourceTabs({ source, base, params = {} }: { source: string; base: string; params?: Record<string, string | undefined> }) {
  const tabs: [string, string][] = [["live", "Live calls"], ["replay", "Practice replays"], ["all", "All"]];
  const href = (s: string) => {
    const p = new URLSearchParams(Object.entries({ ...params, source: s }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${p}`;
  };
  return (
    <nav aria-label="Data source" className="inline-flex rounded-xl border border-line bg-surface p-1 text-sm">
      {tabs.map(([s, label]) => (
        <Link key={s} href={href(s)} aria-current={source === s ? "page" : undefined}
          className={`inline-flex min-h-8 items-center rounded-lg px-3 transition-colors duration-150 ${source === s ? "bg-forest font-semibold text-on-forest shadow-sm" : "text-fg-2 hover:text-fg"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
