import Link from "next/link";
import { notFound } from "next/navigation";
import { getCallDetail } from "@/lib/queries";
import { RULES } from "@/lib/rules";
import { STATUSES, type Turn } from "@/lib/types";
import { dur, Flag, IST, Missing, StatusBadge } from "@/components/ui";

type Field = { value: unknown; quote: string | null } | undefined;
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : (d as string | null));

const FIELD_LABELS: [string, string][] = [
  ["caller_name", "Name"], ["referred_by", "Referred by"], ["heard_via", "Heard via"], ["locality", "Locality (as said)"],
  ["other_city", "Other city"], ["property_type", "Property type"], ["property_detail", "Property"], ["size_sqft", "Size (sq ft)"],
  ["bhk", "BHK"], ["scope", "Scope"], ["rooms", "Rooms"], ["site_status", "Site"], ["timeline", "Timeline"],
  ["completion_within_weeks", "Finish within (weeks)"], ["later_start_offered", "Later start offered"],
  ["later_start_accepted", "Later start accepted"], ["decision_maker", "Decision maker"], ["tenant", "Tenant"],
  ["budget_volunteered", "Budget volunteered"], ["budget_min_inr", "Budget min (₹)"], ["budget_max_inr", "Budget max (₹)"],
  ["price_asked", "Asked for price"], ["existing_client_complaint", "Existing-client complaint"],
  ["asks_for_senior", "Asked for Nikhil/senior"], ["prior_contact_frustrated", "Prior contact, no follow-up"], ["booked", "Booked in call"],
];

const show = (v: unknown) => (v === null || v === undefined || v === "" ? <Missing /> : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));

export default async function CallDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const d = await getCallDetail(Number(id));
  if (!d) notFound();
  const { call, enquiry, rules, notifications, siblings, errors } = d;
  const fields = (enquiry?.fields ?? {}) as Record<string, Field>;
  const transcript = (call.transcript ?? []) as Turn[];
  const completed = call.call_outcome === "completed";
  const status = !completed ? "missed" : enquiry ? ((enquiry.override_status ?? enquiry.status) as string) : null;
  const flags = (enquiry?.flags ?? []) as string[];
  const missing = (enquiry?.missing_fields ?? []) as string[];
  const card = "rounded-lg border border-stone-200 bg-white p-4";

  return (
    <div className="space-y-5">
      <Link href="/calls" className="text-sm text-stone-600 underline">← All calls</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{(fields.caller_name?.value as string) ?? call.caller_number ?? "Unknown caller"}</h1>
          <p className="text-sm text-stone-600">
            {IST(iso(call.started_at) ?? iso(call.created_at))} · {dur(call.duration_sec as number | null)} · {String(call.call_outcome)}
            {call.source === "replay" && " · fixture replay"} · Vaani id <code className="text-xs">{String(call.vaani_call_id)}</code>
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={status} />
          {enquiry?.override_status ? <p className="mt-1 text-xs text-stone-600">Overridden (rules said {String(enquiry.status)}): {String(enquiry.override_reason)}</p> : null}
          <div className="mt-2">{flags.map((f) => <Flag key={f} name={f} />)}</div>
        </div>
      </div>

      {siblings.length > 0 && (
        <div className="rounded-md bg-stone-100 px-3 py-2 text-sm">
          Same enquiry, other calls:{" "}
          {siblings.map((s) => (
            <Link key={String(s.id)} href={`/calls/${s.id}`} className="mr-3 underline">{IST(iso(s.started_at))} ({String(s.call_outcome)}, {dur(s.duration_sec as number | null)})</Link>
          ))}
        </div>
      )}

      {completed && !enquiry && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          This call has not been processed yet{errors.length ? " — see errors below" : ""}. The next sync retries it.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {enquiry && (
            <section className={card}>
              <h2 className="font-medium">Summary</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-stone-800">{(enquiry.summary as string) || <Missing />}</p>
              <p className="mt-2 text-xs text-stone-500">
                Area: {enquiry.locality_normalised ? `${enquiry.locality_normalised} (from “${enquiry.locality_raw}”, match ${enquiry.locality_confidence})` : <Missing />}
                {" · "}Extracted by {String(enquiry.extractor)}
              </p>
              {missing.length > 0 && <p className="mt-1 text-xs text-amber-800">Missing: {missing.join(", ")}</p>}
            </section>
          )}

          <section className={card}>
            <h2 className="font-medium">Recording</h2>
            {call.source === "live" ? (
              <audio controls preload="none" src={`/api/recording/${call.id}`} className="mt-2 w-full">
                Your browser cannot play this recording.
              </audio>
            ) : (
              <p className="mt-1 text-sm text-stone-500">Fixture replay — no recording exists.</p>
            )}
          </section>

          {enquiry && (
            <section className={card}>
              <h2 className="font-medium">Why this status <span className="text-xs font-normal text-stone-500">(PROXY rules)</span></h2>
              <ul className="mt-2 space-y-1 text-sm">
                {rules.map((r) => (
                  <li key={String(r.rule_id)} className={r.fired ? "text-stone-900" : "text-stone-400"}>
                    <span className="font-mono text-xs">{r.fired ? "●" : "○"} {String(r.rule_id)}</span>{" "}
                    {RULES[String(r.rule_id)] ?? ""}{r.fired ? <b> → {String(r.result)}</b> : null}
                    <div className="pl-5 text-xs">{String(r.detail ?? "")}</div>
                  </li>
                ))}
              </ul>
              {rules.every((r) => !r.fired) && <p className="mt-2 text-sm">No rule fired → qualified.</p>}
            </section>
          )}

          {enquiry && (
            <section className={card}>
              <h2 className="font-medium">Extracted fields</h2>
              <table className="mt-2 w-full text-sm">
                <tbody className="divide-y divide-stone-100">
                  {FIELD_LABELS.map(([k, label]) => (
                    <tr key={k} className="align-top">
                      <td className="w-44 py-1 pr-2 text-stone-500">{label}</td>
                      <td className="py-1">
                        {show(fields[k]?.value)}
                        {fields[k]?.quote && <div className="text-xs italic text-stone-500">“{fields[k]!.quote}”</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className={card}>
            <h2 className="font-medium">Transcript</h2>
            {transcript.length === 0 ? (
              <p className="mt-1 text-sm text-stone-500">No transcript (call {String(call.call_outcome)}).</p>
            ) : (
              <ol className="mt-2 space-y-2 text-sm">
                {transcript.map(([sp, text], i) => (
                  <li key={i} className={sp === "AGENT" ? "pr-8" : "pl-8 text-right"}>
                    <span className={`inline-block rounded-lg px-3 py-1.5 ${sp === "AGENT" ? "bg-stone-100" : "bg-sky-50"}`}>
                      <span className="block text-[10px] uppercase tracking-wide text-stone-500">{sp === "AGENT" ? "Agent" : "Caller"}</span>
                      {text}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {enquiry && (
            <section className={card}>
              <h2 className="font-medium">Notifications & CRM</h2>
              <p className="mt-1 text-sm">
                HubSpot:{" "}
                {enquiry.hubspot_deal_id ? (
                  <>
                    {enquiry.hubspot_deal_url ? <a className="underline" href={String(enquiry.hubspot_deal_url)} target="_blank" rel="noreferrer">deal {String(enquiry.hubspot_deal_id)}</a> : `deal ${enquiry.hubspot_deal_id}`}
                    {" · "}amount ₹{Number(enquiry.amount_inr).toLocaleString("en-IN")} ({String(enquiry.amount_source)}, internal estimate)
                  </>
                ) : "no deal"}
              </p>
              {notifications.length === 0 ? (
                <p className="mt-2 text-sm text-stone-500">No notifications for this enquiry.</p>
              ) : (
                <table className="mt-2 w-full text-xs">
                  <thead className="text-left text-stone-500"><tr><th>Time</th><th>Kind</th><th>Channel</th><th>#</th><th>Result</th></tr></thead>
                  <tbody>
                    {notifications.map((n, i) => (
                      <tr key={i} className="align-top">
                        <td className="pr-2">{IST(iso(n.created_at))}</td>
                        <td className="pr-2">{String(n.kind)}</td>
                        <td className="pr-2">{String(n.channel)}</td>
                        <td className="pr-2">{String(n.attempt)}</td>
                        <td className={n.ok ? "text-emerald-800" : "text-red-700"}>{n.ok ? `sent (${n.provider_id ?? "no id"})` : `failed: ${String(n.error).slice(0, 140)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {enquiry && (
            <section className={card}>
              <h2 className="font-medium">Override status</h2>
              <p className="mt-1 text-xs text-stone-500">The founder makes the final call. Overriding to qualified creates the HubSpot deal and handoff email (live calls only); escalation sends the urgent email.</p>
              {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
              {saved && <p className="mt-2 text-sm text-emerald-800">Saved.</p>}
              <form method="post" action={`/api/calls/${call.id}/override`} className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                <select name="status" defaultValue="" className="rounded-md border border-stone-300 px-2 py-1.5">
                  <option value="" disabled>Choose…</option>
                  {STATUSES.filter((s) => s !== "missed").map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  {enquiry.override_status ? <option value="clear">clear override (use rules)</option> : null}
                </select>
                <input name="reason" placeholder="Reason" className="min-w-48 flex-1 rounded-md border border-stone-300 px-2 py-1.5" />
                <button className="rounded-md bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700">Save</button>
              </form>
            </section>
          )}

          {errors.length > 0 && (
            <section className="rounded-lg border border-red-200 bg-white p-4">
              <h2 className="font-medium text-red-900">Errors</h2>
              <ul className="mt-2 space-y-1 text-xs">
                {errors.map((er, i) => <li key={i}>{IST(iso(er.created_at))} <b>{String(er.step)}</b>: {String(er.message)}</li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
