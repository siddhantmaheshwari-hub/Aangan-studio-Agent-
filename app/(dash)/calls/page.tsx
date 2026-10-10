import Link from "next/link";
import { listCalls } from "@/lib/queries";
import { FLAGS, STATUSES } from "@/lib/types";
import { dur, Flag, IST, StatusBadge } from "@/components/ui";

type SP = { status?: string; flag?: string; from?: string; to?: string; source?: string };

const EMAIL_LABEL = {
  sent: <span className="text-emerald-800">sent</span>,
  telegram: <span className="text-amber-800">sent via Telegram (fallback)</span>,
  failed: <span className="font-medium text-red-700">not delivered</span>,
};

export default async function CallsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const source = sp.source ?? "live";
  const rows = await listCalls({ ...sp, source });
  const filtered = Boolean(sp.status || sp.flag || sp.from || sp.to || (sp.source && sp.source !== "live"));
  const input = "rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Calls</h1>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className={input}>
            <option value="">Any</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500">Flag</span>
          <select name="flag" defaultValue={sp.flag ?? ""} className={input}>
            <option value="">Any</option>
            {FLAGS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500">From</span>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500">To</span>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500">Source</span>
          <select name="source" defaultValue={source} className={input}>
            <option value="live">Live calls</option>
            <option value="replay">Fixture replays</option>
            <option value="all">All</option>
          </select>
        </label>
        <button className="rounded-md bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700">Apply</button>
        {filtered && <Link href="/calls" className="px-2 py-1.5 text-stone-600 underline">Clear filters</Link>}
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
          {filtered ? "No calls match these filters." : "No calls yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                {["Time (IST)", "Duration", "Caller", "Status", "Flags", "Rules", "Booking", "HubSpot", "Email"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-stone-50">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/calls/${r.id}`} className="underline decoration-stone-300 hover:decoration-stone-900">{IST(r.started_at)}</Link>
                    {r.source === "replay" && <div className="text-[11px] text-stone-400">fixture replay</div>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{dur(r.duration_sec)}</td>
                  <td className="px-3 py-2">
                    <div>{r.caller_name ?? <span className="text-stone-400">—</span>}</div>
                    <div className="text-xs text-stone-500">{r.caller_number ?? "number not provided"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.processed || r.call_outcome !== "completed" ? r.status : null} />
                    {r.call_outcome !== "completed" && <div className="mt-1 text-[11px] text-stone-500">{r.call_outcome}{r.enquiry_id ? " · linked to a later call" : ""}</div>}
                  </td>
                  <td className="max-w-[16rem] px-3 py-2">{r.flags.filter((f) => f !== "booked").map((f) => <Flag key={f} name={f} />)}</td>
                  <td className="px-3 py-2 text-xs text-stone-600">{r.rule_ids.join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.flags.includes("booked") ? "booked" : "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.hubspot_deal_url ? <a href={r.hubspot_deal_url} target="_blank" rel="noreferrer" className="underline">deal</a> : r.hubspot_deal_id ? `deal ${r.hubspot_deal_id}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.email ? EMAIL_LABEL[r.email] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-stone-500">{rows.length} call{rows.length === 1 ? "" : "s"}{rows.length === 500 ? " (showing the latest 500)" : ""}.</p>
    </div>
  );
}
