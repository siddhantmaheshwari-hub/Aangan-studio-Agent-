// Small presentational helpers shared by dashboard pages.
const STATUS_STYLE: Record<string, string> = {
  qualified: "bg-emerald-100 text-emerald-900",
  needs_review: "bg-amber-100 text-amber-900",
  incomplete: "bg-stone-200 text-stone-800",
  not_qualified: "bg-slate-200 text-slate-800",
  missed: "bg-zinc-100 text-zinc-600",
  escalation: "bg-red-100 text-red-900",
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="rounded px-2 py-0.5 text-xs bg-orange-100 text-orange-900">not processed</span>;
  return <span className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[status] ?? "bg-stone-100"}`}>{status.replace("_", " ")}</span>;
}

export function Flag({ name }: { name: string }) {
  const critical = name === "price_figure_spoken";
  return (
    <span className={`mr-1 mb-1 inline-block rounded border px-1.5 py-0.5 text-[11px] ${critical ? "border-red-300 bg-red-50 text-red-800 font-semibold" : "border-stone-300 text-stone-700"}`}>
      {name}
    </span>
  );
}

export const IST = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const dur = (s: number | null | undefined) => (s === null || s === undefined ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

export function Missing() {
  return <span className="italic text-stone-400">missing</span>;
}
