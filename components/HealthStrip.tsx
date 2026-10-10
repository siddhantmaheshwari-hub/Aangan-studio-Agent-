import { checkHealth } from "@/lib/health";
import { IST } from "./ui";

function Item({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  // Shape + text, not colour alone: ✓ / ✕ carry the meaning.
  return (
    <li className="flex items-center gap-1.5" title={detail}>
      <span aria-hidden className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${ok ? "bg-ok-bg text-ok" : "bg-danger-bg text-danger"}`}>
        {ok ? "✓" : "✕"}
      </span>
      <span>{label}</span>
      {!ok && <span className="text-danger">— {detail}</span>}
      <span className="sr-only">{ok ? "OK" : "problem"}</span>
    </li>
  );
}

export async function HealthStrip() {
  const h = await checkHealth();
  const syncOk = Boolean(h.lastSyncOk) && Date.now() - Date.parse(h.lastSyncOk!) < 45 * 60_000;
  return (
    <ul aria-label="System health" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-2">
      <Item ok={h.neon.ok} label="Database" detail={h.neon.detail} />
      <Item ok={h.vaani.ok} label="Vaani" detail={h.vaani.detail} />
      <Item ok={syncOk} label={`Last sync ${h.lastSyncOk ? IST(h.lastSyncOk) : "never"}`} detail={h.lastSyncError ?? "no successful sync in the last 45 min"} />
    </ul>
  );
}
