import { checkHealth } from "@/lib/health";
import { IST } from "./ui";

function Dot({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <span className="flex items-center gap-1.5" title={detail}>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
      {label}
      {!ok && <span className="text-red-700">({detail})</span>}
    </span>
  );
}

export async function HealthStrip() {
  const h = await checkHealth();
  const syncOk = Boolean(h.lastSyncOk) && Date.now() - Date.parse(h.lastSyncOk!) < 45 * 60_000;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-stone-700">
      <Dot ok={h.neon.ok} label="Neon" detail={h.neon.detail} />
      <Dot ok={h.vaani.ok} label="Vaani" detail={h.vaani.detail} />
      <Dot ok={syncOk} label={`Last sync: ${h.lastSyncOk ? IST(h.lastSyncOk) : "never"}`} detail={h.lastSyncError ?? "no successful sync in the last 45 min"} />
    </div>
  );
}
