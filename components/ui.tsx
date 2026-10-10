// Shared presentational components. Only design tokens (globals.css) — no raw palette colours.
import Link from "next/link";
import { FLAG_LABEL, STATUS_HELP, STATUS_LABEL } from "@/lib/labels";

const TONE = {
  ok: "bg-ok-bg text-ok",
  sage: "bg-sage-soft text-forest",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-neutral-bg text-neutral",
} as const;
export type Tone = keyof typeof TONE;

const STATUS_TONE: Record<string, Tone> = {
  qualified: "sage",
  needs_review: "warn",
  incomplete: "info",
  not_qualified: "neutral",
  missed: "neutral",
  escalation: "danger",
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE.warn}`}>Not processed</span>;
  return (
    <span title={STATUS_HELP[status]} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[STATUS_TONE[status] ?? "neutral"]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Flag({ name }: { name: string }) {
  const f = FLAG_LABEL[name] ?? { label: name, help: name, tone: "neutral" as const };
  const style = f.tone === "danger" ? `${TONE.danger} font-semibold` : f.tone === "warn" ? TONE.warn : "border border-line text-fg-2";
  return (
    <span title={f.help} className={`mb-1 mr-1 inline-block rounded-full px-2 py-0.5 text-xs ${style}`}>
      {f.label}
    </span>
  );
}

export function Card({ title, aside, children, tone, className = "" }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; tone?: Tone; className?: string }) {
  const border = tone === "danger" ? "border-danger/60" : tone === "warn" ? "border-warn/50" : "border-line";
  return (
    <section className={`rounded-3xl border ${border} bg-surface p-6 shadow-card ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          {title && <h2 className="font-display text-[19px] font-semibold leading-snug text-fg">{title}</h2>}
          {aside && <div className="text-xs text-fg-3">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-10 text-center text-sm text-fg-2">{children}</div>;
}

export function ButtonLink({ href, children, variant = "secondary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  const cls = variant === "primary" ? "bg-forest text-on-forest hover:bg-forest-hover" : "border border-line bg-surface text-fg hover:bg-surface-2";
  return <Link href={href} className={`inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-medium transition-colors duration-150 ${cls}`}>{children}</Link>;
}

export const buttonPrimary = "inline-flex min-h-10 items-center justify-center rounded-xl bg-forest px-4 text-sm font-medium text-on-forest transition-colors duration-150 hover:bg-forest-hover disabled:cursor-not-allowed disabled:opacity-50";
export const inputCls = "min-h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg";

/** Page title in the display serif, with an optional line underneath and actions on the right. */
export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-fg sm:text-[32px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-fg-2">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/** A headline number with an optional change vs the previous period. */
export function Kpi({ label, value, delta, icon, note, href }: {
  label: string; value: string | number; delta?: { now: number; before: number; goodWhenUp?: boolean } | null;
  icon?: React.ReactNode; note?: string; href?: string;
}) {
  let change: React.ReactNode = null;
  if (delta) {
    const { now, before, goodWhenUp = true } = delta;
    if (before === 0 && now === 0) change = <span className="text-fg-3">No change</span>;
    else if (before === 0) change = <span className="text-fg-3">New this week</span>;
    else {
      const pct = Math.round(((now - before) / before) * 100);
      const good = pct === 0 ? null : (pct > 0) === goodWhenUp;
      change = (
        <span className={good === null ? "text-fg-3" : good ? "font-semibold text-forest" : "font-semibold text-danger"}>
          <span aria-hidden>{pct > 0 ? "↑" : pct < 0 ? "↓" : "→"}</span> {Math.abs(pct)}% <span className="font-normal text-fg-3">vs last week</span>
        </span>
      );
    }
  }
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-fg-2">{label}</span>
        {icon && <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage-soft text-forest">{icon}</span>}
      </div>
      <div className="font-display mt-2 text-[40px] font-semibold leading-none tabular-nums text-fg">{value}</div>
      <div className="mt-3 min-h-6 text-xs">
        {change ? <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 ring-1 ring-line">{change}</span> : <span className="text-fg-3">{note}</span>}
      </div>
    </>
  );
  const cls = "relative block overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-card";
  return href ? <Link href={href} className={`${cls} transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-sage`}>{body}</Link> : <div className={cls}>{body}</div>;
}

const istDate = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts });

export const IST = (iso: string | null | undefined) =>
  iso ? istDate(iso, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** "12 min ago", "3 h ago", "2 days ago" — for queue items. */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export const dur = (s: number | null | undefined) => (s === null || s === undefined ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

export const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : (d as string | null));
