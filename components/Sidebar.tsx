"use client";
// Side navigation (desktop) and a compact top bar (mobile). Active page shown in sage.
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  overview: <path d="M4 13h6V4H4zm0 7h6v-4H4zm10 0h6v-9h-6zm0-16v4h6V4z" />,
  review: <path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />,
  calls: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  system: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <svg aria-hidden viewBox="0 0 32 32" className="h-8 w-8">
        <rect width="32" height="32" rx="9" fill="var(--beige)" />
        <path d="M8 24V14a8 8 0 0 1 16 0v10M12 24v-8a4 4 0 0 1 8 0v8M6 24h20" fill="none" stroke="var(--sage-deep)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="leading-tight">
        <span className="font-display block text-[17px] font-semibold text-fg">Aangan</span>
        <span className="block text-xs text-fg-3">Enquiry desk</span>
      </span>
    </Link>
  );
}

export function Nav({ reviewCount }: { reviewCount: number }) {
  const path = usePathname();
  const items = [
    { href: "/", key: "overview", label: "Overview", active: path === "/" },
    { href: "/review", key: "review", label: "Review queue", active: path.startsWith("/review"), badge: reviewCount },
    { href: "/calls", key: "calls", label: "Calls", active: path.startsWith("/calls") },
    { href: "/system", key: "system", label: "System", active: path.startsWith("/system") },
  ];
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.active ? "page" : undefined}
          className={`group relative flex min-h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150 ${
            i.active ? "bg-beige font-semibold text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg"}`}>
          {i.active && <span aria-hidden className="absolute left-0 top-2.5 bottom-2.5 hidden w-[3px] rounded-full bg-sage lg:block" />}
          <Icon name={i.key} />
          <span>{i.label}</span>
          {i.badge ? (
            <span className="ml-auto rounded-full bg-fg px-2 py-0.5 text-xs font-semibold tabular-nums text-bg" aria-label={`${i.badge} waiting`}>{i.badge}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
