// Call detail. Decision first (when one is needed), then the evidence behind it.
import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionForm } from "@/components/DecisionForm";
import { buttonPrimary, Card, dur, Flag, IST, iso, StatusBadge } from "@/components/ui";
import { formatValue, ruleTitle, STATUS_HELP, STATUS_LABEL } from "@/lib/labels";
import { MAX_ATTEMPTS } from "@/lib/pipeline";
import { scanAgentTurns } from "@/lib/priceScanner";
import { getCallDetail } from "@/lib/queries";
import { STATUSES, type Turn } from "@/lib/types";

type Field = { value: unknown; quote: string | null } | undefined;

// Facts the team needs before calling back, in the order they ask for them.
const KEY_FACTS: [string, string][] = [
  ["caller_name", "Name"], ["locality", "Area"], ["property_type", "Property type"], ["property_detail", "Property"],
  ["size_sqft", "Size (sq ft)"], ["bhk", "BHK"], ["scope", "Scope"], ["rooms", "Rooms"], ["timeline", "Wants it finished"],
  ["decision_maker", "Who decides"], ["referred_by", "Referred by"],
];
// Shown only when the caller actually said something about them.
const OTHER_FACTS: [string, string][] = [
  ["heard_via", "Heard about us via"], ["other_city", "City"], ["site_status", "Site"], ["completion_within_weeks", "Finish within (weeks)"],
  ["later_start_offered", "Later start offered"], ["later_start_accepted", "Later start accepted"], ["tenant", "Tenant"],
  ["budget_min_inr", "Budget from"], ["budget_max_inr", "Budget up to"], ["price_asked", "Asked for a price"],
  ["existing_client_complaint", "Existing-client complaint"], ["asks_for_senior", "Asked for Nikhil / senior"],
  ["prior_contact_frustrated", "Earlier enquiry not followed up"], ["booked", "Booked in call"],
];
const LABEL_OF = Object.fromEntries([...KEY_FACTS, ...OTHER_FACTS]);

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

type SP = { error?: string; saved?: string; notice?: string };

export default async function CallDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const d = await getCallDetail(Number(id));
  if (!d) notFound();
  const { call, enquiry, rules, notifications, siblings, errors, audit } = d;

  const fields = (enquiry?.fields ?? {}) as Record<string, Field>;
  const transcript = (call.transcript ?? []) as Turn[];
  const completed = call.call_outcome === "completed";
  const live = call.source === "live";
  const status = !completed ? "missed" : enquiry ? String(enquiry.override_status ?? enquiry.status) : null;
  const flags = (enquiry?.flags ?? []) as string[];
  const fired = rules.filter((r) => r.fired);
  const passed = rules.filter((r) => !r.fired);
  const sentOk = (kind: string) => notifications.some((n) => n.kind === kind && n.ok);
  const deliveryFailed = (status === "qualified" || status === "escalation") && notifications.some((n) => n.kind === (status === "qualified" ? "handoff" : "escalation")) && !sentOk(status === "qualified" ? "handoff" : "escalation");
  const needsDecision = Boolean(enquiry) && ((!enquiry!.override_status && ["needs_review", "incomplete"].includes(String(enquiry!.status))) || status === "escalation" || deliveryFailed);
  const stuck = completed && !enquiry;
  const name = (fields.caller_name?.value as string) ?? call.caller_number ?? "Unknown caller";

  // Evidence: which transcript lines support which facts, and where the agent spoke a price.
  const priceTurns = new Set(scanAgentTurns(transcript).map((h) => h.turnIndex));
  const usedFor = new Map<number, string[]>();
  for (const [k, f] of Object.entries(fields)) {
    if (!f?.quote || !LABEL_OF[k]) continue;
    const q = norm(f.quote);
    const idx = transcript.findIndex(([sp, t]) => sp === "USER" && q.length > 3 && norm(t).includes(q));
    if (idx >= 0) usedFor.set(idx, [...(usedFor.get(idx) ?? []), LABEL_OF[k]]);
  }

  const decision = enquiry && (
    <DecisionForm
      callId={Number(call.id)} current={status ?? ""} rulesStatus={String(enquiry.status)} overridden={Boolean(enquiry.override_status)}
      live={live} hasDeal={Boolean(enquiry.hubspot_deal_id)} handoffSent={sentOk("handoff")} escalationSent={sentOk("escalation")}
      statuses={STATUSES.filter((s) => s !== "missed").map((s) => ({ value: s, label: STATUS_LABEL[s], help: STATUS_HELP[s] }))}
    />
  );

  const fact = (k: string, label: string, always: boolean) => {
    const f = fields[k];
    const value = k === "locality" && enquiry?.locality_normalised
      ? `${enquiry.locality_normalised}${f?.value && f.value !== enquiry.locality_normalised ? ` (said “${f.value}”)` : ""}`
      : formatValue(f?.value, k);
    if (!value && !always) return null;
    return (
      <div key={k} className="grid grid-cols-[9rem_1fr] gap-2 py-1.5">
        <dt className="text-fg-3">{label}</dt>
        <dd>
          {value || <span className="text-fg-3">Not mentioned</span>}
          {f?.quote && <q className="block text-xs italic text-fg-2">{f.quote}</q>}
        </dd>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Link href="/calls" className="inline-flex min-h-9 items-center gap-1 rounded-lg text-sm text-fg-2 hover:text-fg">← All calls</Link>

      {(sp.saved || sp.notice || sp.error) && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${sp.error ? "bg-danger-bg text-danger" : "bg-ok-bg text-ok"}`}>
          {sp.error ?? sp.notice ?? "Decision saved and recorded in the audit log."}
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight sm:text-[32px]">{name}</h1>
          <p className="text-sm text-fg-2">
            {IST(iso(call.started_at) ?? iso(call.created_at))} IST · {dur(call.duration_sec as number | null)} · {String(call.call_outcome)}
            {call.caller_number && name !== call.caller_number ? ` · ${call.caller_number}` : ""}
            {!live && " · fixture replay"}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={status} />
          {Boolean(enquiry?.override_status) && <p className="mt-1 text-xs text-fg-2">Your decision (rules said {STATUS_LABEL[String(enquiry.status)]})</p>}
          <div className="mt-2 max-w-md">{flags.map((f) => <Flag key={f} name={f} />)}</div>
        </div>
      </header>

      {siblings.length > 0 && (
        <p className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm">
          Same caller, same enquiry:{" "}
          {siblings.map((s) => (
            <Link key={String(s.id)} href={`/calls/${s.id}`} className="mr-3 text-accent underline">
              {IST(iso(s.started_at))} ({String(s.call_outcome)}, {dur(s.duration_sec as number | null)})
            </Link>
          ))}
        </p>
      )}

      {stuck && (
        <Card title="This call hasn't been processed" tone="warn">
          <p className="text-sm text-fg-2">
            The call is saved, but the pipeline failed {Number(call.attempts)}× (latest error below).{" "}
            {Number(call.attempts) >= MAX_ATTEMPTS ? "Automatic retries have stopped." : "It is retried automatically on the next sync."}
          </p>
          {errors[0] && <p className="mt-2 rounded bg-surface-2 p-2 font-mono text-xs">{String(errors[0].message)}</p>}
          <form method="post" action={`/api/calls/${call.id}/retry`} className="mt-3">
            <button className={buttonPrimary}>Retry now</button>
          </form>
        </Card>
      )}

      {needsDecision && (
        <Card tone={status === "escalation" || deliveryFailed ? "danger" : "warn"}
          title={status === "escalation" ? "Escalation — an existing client needs a call back" : deliveryFailed ? "The email didn't get through" : "Your decision is needed"}>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="text-sm">
              <p className="font-medium">Why it&apos;s here</p>
              <ul className="mt-1 space-y-2">
                {fired.map((r) => (
                  <li key={String(r.rule_id)}>
                    <span className="font-mono text-xs text-fg-3">{String(r.rule_id)}</span> {ruleTitle(String(r.rule_id))}
                    <span className="block text-fg-2">{String(r.detail ?? "")}</span>
                  </li>
                ))}
                {deliveryFailed && <li className="text-danger">Every delivery attempt failed — see Notifications below. Contact the team directly.</li>}
              </ul>
              {status === "escalation" && (
                <p className="mt-3 rounded-md bg-surface-2 p-2 text-fg-2">
                  The agent promised no callback time. Urgent email: <b className="text-fg">{sentOk("escalation") ? "sent" : "not delivered"}</b>. No HubSpot deal is created for complaints.
                </p>
              )}
            </div>
            {status !== "escalation" ? decision : (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Change status (only if this isn&apos;t really a complaint)</summary>
                <div className="mt-3">{decision}</div>
              </details>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {enquiry && (
            <Card title="Summary" aside={String(enquiry.extractor).startsWith("gemini") ? "Written by AI — check against the transcript" : `Extractor: ${enquiry.extractor}`}>
              <p className="whitespace-pre-line text-sm">{(enquiry.summary as string) || <span className="text-fg-3">No summary</span>}</p>
              {(enquiry.missing_fields as string[]).length > 0 && (
                <p className="mt-2 text-sm text-warn">Not captured in the call: {(enquiry.missing_fields as string[]).join(", ")}</p>
              )}
            </Card>
          )}

          {enquiry && (
            <Card title="What the caller told us" aside="Quotes are the caller's own words">
              <dl className="divide-y divide-line text-sm">
                {KEY_FACTS.map(([k, l]) => fact(k, l, true))}
                {OTHER_FACTS.map(([k, l]) => fact(k, l, false))}
              </dl>
              {Boolean(enquiry.locality_normalised) && Number(enquiry.locality_confidence) < 1 && (
                <p className="mt-2 text-xs text-fg-2">Area matched by spelling similarity ({Math.round(Number(enquiry.locality_confidence) * 100)}%). Confirm it on the call back.</p>
              )}
            </Card>
          )}

          <Card title="Recording">
            {live ? (
              <audio controls preload="none" src={`/api/recording/${call.id}`} className="w-full" aria-label={`Recording of the call with ${name}`}>
                Your browser can&apos;t play this recording.
              </audio>
            ) : (
              <p className="text-sm text-fg-3">Fixture replay — there is no recording.</p>
            )}
          </Card>
        </div>

        <Card title="Transcript" aside={transcript.length ? `${transcript.length} lines` : undefined}>
          {transcript.length === 0 ? (
            <p className="text-sm text-fg-3">No transcript (call {String(call.call_outcome)}).</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {transcript.map(([sp, text], i) => {
                const price = priceTurns.has(i);
                const used = usedFor.get(i);
                return (
                  <li key={i} className={sp === "AGENT" ? "pr-8" : "pl-8"}>
                    <div className={`rounded-2xl px-3.5 py-2.5 ${price ? "border-2 border-danger bg-danger-bg" : sp === "AGENT" ? "bg-surface-2" : "border border-line bg-sage-soft/40"}`}>
                      <span className="block text-xs font-semibold text-fg-3">{sp === "AGENT" ? "Agent" : "Caller"}</span>
                      {text}
                      {price && <span className="mt-1 block text-xs font-semibold text-danger">⚠ Price figure spoken by the agent</span>}
                      {used && <span className="mt-1 block text-xs text-fg-3">Used for: {used.join(", ")}</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      {enquiry && (
        <Card title="How the status was decided" aside="PROXY rules · decided in code, not by AI">
          {fired.length === 0 ? (
            <p className="text-sm">No rule fired, so the enquiry is <b>Qualified</b>.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {fired.map((r) => (
                <li key={String(r.rule_id)}>
                  <span className="font-mono text-xs">{String(r.rule_id)}</span> {ruleTitle(String(r.rule_id))} → <b>{STATUS_LABEL[String(r.result)]}</b>
                  <span className="block pl-4 text-fg-2">{String(r.detail ?? "")}</span>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-fg-2">Show the {passed.length} rules that passed</summary>
            <ul className="mt-2 space-y-1 text-fg-2">
              {passed.map((r) => (
                <li key={String(r.rule_id)}><span className="font-mono text-xs">{String(r.rule_id)}</span> {ruleTitle(String(r.rule_id))} — {String(r.detail ?? "")}</li>
              ))}
            </ul>
          </details>
          {fired.length > 1 && <p className="mt-2 text-xs text-fg-3">When several rules fire, the strongest wins: escalation › missed › not a fit › needs review › incomplete › qualified.</p>}
        </Card>
      )}

      {enquiry && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Notifications & HubSpot">
            <p className="text-sm">
              HubSpot:{" "}
              {enquiry.hubspot_deal_id ? (
                <>
                  {enquiry.hubspot_deal_url ? <a className="text-accent underline" href={String(enquiry.hubspot_deal_url)} target="_blank" rel="noreferrer">deal {String(enquiry.hubspot_deal_id)} ↗</a> : `deal ${enquiry.hubspot_deal_id}`}
                  {" · "}₹{Number(enquiry.amount_inr).toLocaleString("en-IN")} ({enquiry.amount_source === "caller_budget" ? "caller's budget" : "studio average"}, internal forecast only)
                </>
              ) : status === "qualified" ? (live ? "no deal yet" : "dry run — no deal for replays") : "not needed for this status"}
            </p>
            {notifications.length === 0 ? (
              <p className="mt-2 text-sm text-fg-3">{status === "qualified" || status === "escalation" ? (live ? "No email attempted yet." : "Dry run — replays send nothing.") : "No email needed for this status."}</p>
            ) : (
              <table className="mt-2 w-full text-xs">
                <caption className="sr-only">Delivery attempts</caption>
                <thead className="text-left text-fg-3"><tr><th scope="col">When</th><th scope="col">Message</th><th scope="col">Channel</th><th scope="col">Try</th><th scope="col">Result</th></tr></thead>
                <tbody>
                  {notifications.map((n, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1 pr-2">{IST(iso(n.created_at))}</td>
                      <td className="pr-2">{String(n.kind)}</td>
                      <td className="pr-2">{String(n.channel)}</td>
                      <td className="pr-2">{String(n.attempt)}</td>
                      <td className={n.ok ? "text-ok" : "text-danger"}>{n.ok ? "Delivered" : `Failed: ${String(n.error).slice(0, 140)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Activity" aside="Audit log">
            {audit.length === 0 ? <p className="text-sm text-fg-3">No activity recorded.</p> : (
              <ul className="space-y-1 text-xs text-fg-2">
                {audit.map((a, i) => {
                  const detail = a.detail as { reason?: string; status?: string } | null;
                  return (
                    <li key={i}>
                      <span className="text-fg-3">{IST(iso(a.created_at))}</span> <b className="text-fg">{String(a.actor)}</b> {String(a.action).replace(/_/g, " ")}
                      {detail?.reason ? ` → ${STATUS_LABEL[detail.status ?? ""] ?? detail.status}: “${detail.reason}”` : ""}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {enquiry && !needsDecision && (
        <Card>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Change status</summary>
            <p className="mt-1 text-fg-2">The founder makes the final call. You&apos;ll see what will be sent before saving.</p>
            <div className="mt-3">{decision}</div>
          </details>
        </Card>
      )}

      {errors.length > 0 && !stuck && (
        <Card title="Problems with this call" tone="danger">
          <ul className="space-y-1 text-xs">
            {errors.map((er, i) => <li key={i}>{IST(iso(er.created_at))} <b>{String(er.step)}</b>: {String(er.message)}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
