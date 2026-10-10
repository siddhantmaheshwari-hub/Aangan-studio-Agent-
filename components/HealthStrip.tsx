import { checkHealth } from "@/lib/health";
import { IST } from "./ui";

function Item({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  // Shape + text, not colour alone.
  return (
    <li className="flex items-center gap-2" title={detail}>
      <span aria-hidden className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${ok ? "bg-ok-bg text-ok" : "bg-danger-bg text-danger"}`}>
        {ok ? "✓" : "!"}
      </span>
      <span className="min-w-0 truncate">{label}</span>
      <span className="sr-only">{ok ? "working" : `problem: ${detail}`}</span>
    </li>
  );
}

export async function HealthStrip({ vertical = false }: { vertical?: boolean }) {
  const h = await checkHealth();
  const live = h.lastSyncOk && Date.now() - Date.parse(h.lastSyncOk) < 45 * 60_000;
  return (
    <div>
      {vertical && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-3">System</p>}
      <ul aria-label="System health" className={`text-xs text-fg-2 ${vertical ? "space-y-1.5" : "flex flex-wrap gap-x-4 gap-y-1"}`}>
        <Item ok={h.neon.ok} label="Database" detail={h.neon.detail} />
        <Item ok={h.vaani.ok} label="Vaani" detail={h.vaani.detail} />
        <Item ok={Boolean(live) || !h.lastSyncOk} label={h.lastSyncOk ? `Synced ${IST(h.lastSyncOk)}` : "Calls arrive by webhook"} detail={h.lastSyncError ?? "no successful sync in the last 45 min"} />
      </ul>
    </div>
  );
}
