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
    <Link href="/" className="flex items-center gap-3.5 rounded-xl px-1 py-1">
      <svg aria-hidden viewBox="0 0 44 44" className="h-11 w-11 shrink-0 drop-shadow-sm">
        <rect width="44" height="44" rx="12" fill="var(--forest)" />
        <path d="M11 33V20a11 11 0 0 1 22 0v13M17 33V22a5 5 0 0 1 10 0v11M8 33h28" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="31" cy="12" r="2.4" fill="#d9c9ae" />
      </svg>
      <span className="leading-none">
        <span className="font-display block text-[28px] font-semibold tracking-tight text-fg">Aangan</span>
        <span className="mt-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-fg-3">Enquiry desk</span>
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
            i.active ? "bg-forest font-semibold text-on-forest shadow-sm" : "text-fg-2 hover:bg-sage-soft hover:text-sage-deep"}`}>
          <Icon name={i.key} />
          <span>{i.label}</span>
          {i.badge ? (
            <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${i.active ? "bg-white/20 text-on-forest" : "bg-forest text-on-forest"}`} aria-label={`${i.badge} waiting`}>{i.badge}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
