// Shared presentational components. Only design tokens (globals.css) — no raw palette colours.
import Link from "next/link";
import { FLAG_LABEL, STATUS_HELP, STATUS_LABEL } from "@/lib/labels";

const TONE = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-neutral-bg text-neutral",
} as const;
export type Tone = keyof typeof TONE;

const STATUS_TONE: Record<string, Tone> = {
  qualified: "ok",
  needs_review: "warn",
  incomplete: "info",
  not_qualified: "neutral",
  missed: "neutral",
  escalation: "danger",
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className={`rounded px-2 py-0.5 text-xs font-medium ${TONE.warn}`}>Not processed</span>;
  return (
    <span title={STATUS_HELP[status]} className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${TONE[STATUS_TONE[status] ?? "neutral"]}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Flag({ name }: { name: string }) {
  const f = FLAG_LABEL[name] ?? { label: name, help: name, tone: "neutral" as const };
  const style = f.tone === "danger" ? `${TONE.danger} font-semibold` : f.tone === "warn" ? TONE.warn : "border border-line text-fg-2";
  return (
    <span title={f.help} className={`mb-1 mr-1 inline-block rounded px-1.5 py-0.5 text-xs ${style}`}>
      {f.label}
    </span>
  );
}

export function Card({ title, aside, children, tone, className = "" }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; tone?: Tone; className?: string }) {
  const border = tone === "danger" ? "border-danger" : tone === "warn" ? "border-warn" : "border-line";
  return (
    <section className={`rounded-lg border ${border} bg-surface p-4 ${className}`}>
      {(title || aside) && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          {aside && <div className="text-xs text-fg-3">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-fg-2">{children}</div>;
}

export function ButtonLink({ href, children, variant = "secondary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  const cls = variant === "primary" ? "bg-accent text-accent-fg hover:bg-accent-hover" : "border border-line bg-surface text-fg hover:bg-surface-2";
  return <Link href={href} className={`inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium ${cls}`}>{children}</Link>;
}

export const buttonPrimary = "inline-flex min-h-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
export const inputCls = "min-h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg";

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
