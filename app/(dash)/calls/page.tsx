import Link from "next/link";
import { FLAG_LABEL, ruleTitle, STATUS_LABEL } from "@/lib/labels";
import { type CallListRow, listCalls } from "@/lib/queries";
import { FLAGS, STATUSES } from "@/lib/types";
import { buttonPrimary, dur, Empty, Flag, inputCls, IST, PageHeader, StatusBadge } from "@/components/ui";

type SP = { status?: string; flag?: string; from?: string; to?: string; source?: string };

/** Delivery cell for one channel: distinguishes "not needed" from "not sent" from "failed". */
function Delivery({ r, state }: { r: CallListRow; state: "sent" | "failed" | null }) {
  if (state === "sent") return <span className="text-ok">Sent</span>;
  if (state === "failed") return <span className="font-semibold text-danger">Failed</span>;
  const needed = r.status === "qualified" || r.status === "escalation";
  if (!needed) return <span className="text-fg-3" title="Nothing is sent for this status">Not needed</span>;
  return <span className="text-fg-3">{r.source === "replay" ? "Dry run" : "Not sent"}</span>;
}

function Hubspot({ r }: { r: CallListRow }) {
  if (r.hubspot_deal_url) return <a href={r.hubspot_deal_url} target="_blank" rel="noreferrer" className="text-accent underline">Open deal ↗</a>;
  if (r.hubspot_deal_id) return <span>Deal {r.hubspot_deal_id}</span>;
  if (r.status !== "qualified") return <span className="text-fg-3">Not needed</span>;
  return <span className="text-fg-3">{r.source === "replay" ? "Dry run" : "No deal yet"}</span>;
}

export default async function CallsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const source = sp.source ?? "live";
  const rows = await listCalls({ ...sp, source });
  const filtered = Boolean(sp.status || sp.flag || sp.from || sp.to || (sp.source && sp.source !== "live"));

  return (
    <div className="space-y-4">
      <PageHeader title="Calls" sub="Every call the agent answered, newest first. Click a caller to see the transcript, recording and decision." />

      <form method="get" aria-label="Filter calls" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 text-sm shadow-card">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-fg-2">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className={inputCls}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-fg-2">Flag</span>
          <select name="flag" defaultValue={sp.flag ?? ""} className={inputCls}>
            <option value="">Any flag</option>
            {FLAGS.map((f) => <option key={f} value={f}>{FLAG_LABEL[f]?.label ?? f}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-fg-2">From</span>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-fg-2">To</span>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-fg-2">Source</span>
          <select name="source" defaultValue={source} className={inputCls}>
            <option value="live">Live calls</option>
            <option value="replay">Fixture replays</option>
            <option value="all">All</option>
          </select>
        </label>
        <button className={buttonPrimary}>Apply filters</button>
        {filtered && <Link href="/calls" className="inline-flex min-h-9 items-center px-2 text-fg-2 underline">Clear filters</Link>}
      </form>

      <p aria-live="polite" className="text-sm text-fg-2">
        {rows.length} call{rows.length === 1 ? "" : "s"}{rows.length === 500 ? " (latest 500)" : ""}
        {source !== "live" && ` · ${source === "replay" ? "fixture replays" : "live + replays"}`}
      </p>

      {rows.length === 0 ? (
        <Empty>
          {filtered ? <>No calls match these filters. <Link href="/calls" className="text-accent underline">Clear filters</Link></> : "No live calls yet. They appear after the Vaani webhook or the next sync (every 15 min)."}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Calls, newest first</caption>
            <thead className="border-b border-line text-left text-xs text-fg-3">
              <tr>
                {["When (IST)", "Caller", "Status", "Rules fired", "Flags", "Length", "Booking", "HubSpot", "Email", "Telegram"].map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-surface-2">
                  <td className="whitespace-nowrap px-4 py-3">
                    {IST(r.started_at)}
                    {r.source === "replay" && <div className="text-xs text-fg-3">Fixture replay</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/calls/${r.id}`} className="font-medium text-accent underline decoration-line underline-offset-2 hover:decoration-accent">
                      {r.caller_name ?? r.caller_number ?? "Unknown caller"}
                    </Link>
                    <div className="text-xs text-fg-3">{r.area ?? (r.caller_name ? r.caller_number : null) ?? (r.caller_number ? "" : "No number (web test call)")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.processed || r.call_outcome !== "completed" ? r.status : null} />
                    {r.call_outcome !== "completed" && <div className="mt-1 text-xs text-fg-3">{r.call_outcome}{r.enquiry_id ? " · caller rang back" : ""}</div>}
                    {!r.processed && r.call_outcome === "completed" && r.attempts > 0 && <div className="mt-1 text-xs text-warn">failed {r.attempts}×</div>}
                  </td>
                  <td className="max-w-56 px-4 py-3 text-xs text-fg-2">
                    {r.rule_ids.length ? r.rule_ids.map((id) => <div key={id}><span className="font-mono text-fg">{id}</span> {ruleTitle(id)}</div>) : r.status === "qualified" ? "All rules passed" : "—"}
                  </td>
                  <td className="max-w-56 px-4 py-3">{r.flags.filter((f) => f !== "booked").map((f) => <Flag key={f} name={f} />)}</td>
                  <td className="px-4 py-3 tabular-nums text-fg-2">{dur(r.duration_sec)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">{r.flags.includes("booked") ? <span className="text-ok">Booked</span> : <span className="text-fg-3">Not booked</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs"><Hubspot r={r} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs"><Delivery r={r} state={r.email} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs"><Delivery r={r} state={r.telegram} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
