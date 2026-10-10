// Overview. One job: show the founder what needs a decision, then how the desk is doing.
import Link from "next/link";
import { Donut, Gauge, StackedBars } from "@/components/charts";
import { QueueList } from "@/components/QueueList";
import { SourceTabs } from "@/components/SourceTabs";
import { ButtonLink, Card, dur, Empty, Kpi, StatusBadge } from "@/components/ui";
import { env } from "@/lib/env";
import { aiQuality, lastSevenDays, outcomeMix, weekCompare } from "@/lib/insights";
import { STATUS_LABEL } from "@/lib/labels";
import { actionQueue, listCalls, overview } from "@/lib/queries";

const ist = (opts: Intl.DateTimeFormatOptions) => new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts });

function greeting() {
  const h = Number(ist({ hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const I = {
  phone: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4l2.7.7a2 2 0 0 1 1.9 2.1z" /></svg>,
  check: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>,
  cal: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  alert: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>,
};

const MIX_COLOR: Record<string, string> = {
  qualified: "var(--c1)", needs_review: "var(--c2)", incomplete: "var(--c4)", escalation: "var(--c3)", not_qualified: "var(--c5)", missed: "var(--line)",
};

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const { source = "live" } = await searchParams;
  const [o, queue, week, days, mix, ai, recent] = await Promise.all([
    overview({ source }), actionQueue(source), weekCompare(source), lastSevenDays(source), outcomeMix(source), aiQuality(source),
    listCalls({ source }).then((r) => r.slice(0, 6)),
  ]);
  const e = env();
  const s = `&source=${source}`;
  const c = week.current, p = week.previous;
  const fitRate = c.completed ? Math.round((c.qualified / c.completed) * 100) : null;
  const vaaniRate = e.vaaniCostPerMinInr;
  const costPerCall = o.completed && o.vaaniCostInr !== null ? Math.round(((o.vaaniCostInr ?? 0) + (o.geminiCostInr ?? 0)) / o.completed) : null;
  const target = 15;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight sm:text-[34px]">{greeting()}, Nikhil</h1>
          <p className="mt-1 text-sm text-fg-2">Here&apos;s how the enquiry desk is doing — {ist({ weekday: "long", day: "numeric", month: "long" })}.</p>
        </div>
        <SourceTabs source={source} base="/" />
      </div>

      {source !== "live" && (
        <p className="rounded-xl bg-info-bg px-4 py-2.5 text-sm text-info">
          You&apos;re looking at {source === "replay" ? "practice replays (test data from the case transcripts)" : "live calls and practice replays together"}. Practice replays send no emails and create no deals.
        </p>
      )}

      {/* Row 1 — hero + speed to lead */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-3xl p-6 text-white shadow-card lg:col-span-2 sm:p-7"
          style={{ background: "linear-gradient(135deg, #3f4a38 0%, #56634d 50%, #63725a 100%)" }}>
          <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72">
            <circle cx="100" cy="100" r="60" fill="#fff" opacity="0.07" />
            <circle cx="100" cy="100" r="85" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="98" fill="none" stroke="#fff" strokeOpacity="0.05" strokeWidth="1.5" />
          </svg>
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm text-white/85">Enquiry calls · last 7 days</p>
              <p className="font-display mt-1 text-6xl font-semibold leading-none tabular-nums">{c.calls}</p>
              {c.calls === 0 && (
                <p className="mt-2 max-w-xs text-sm text-white/85">
                  {source === "replay" ? "Practice replays are dated September, so this week is empty. See the outcome mix below." : "No calls this week yet. Make a test call in Vaani and it lands here about a minute after it ends."}
                </p>
              )}
              <dl className="mt-6 flex flex-wrap gap-6 text-sm">
                <div><dt className="text-white/80">Qualified</dt><dd className="font-display text-2xl font-semibold tabular-nums">{c.qualified}</dd></div>
                <div><dt className="text-white/80">Booked in call</dt><dd className="font-display text-2xl font-semibold tabular-nums">{c.booked}</dd></div>
                <div><dt className="text-white/80">Talk time</dt><dd className="font-display text-2xl font-semibold tabular-nums">{Math.round(c.seconds / 60)} min</dd></div>
              </dl>
            </div>
            <div className="w-full max-w-sm rounded-2xl bg-white/95 p-4 text-fg sm:w-72">
              <StackedBars height={130} caption="Calls per day for the last 7 days, by outcome"
                data={days.map((d) => ({ label: d.label, values: { qualified: d.qualified, review: d.review, notFit: d.notFit, missed: d.missed } }))}
                series={[
                  { key: "qualified", label: "Qualified", color: "var(--c1)" },
                  { key: "review", label: "Needs a person", color: "var(--c2)" },
                  { key: "notFit", label: "Not a fit", color: "var(--c5)" },
                  { key: "missed", label: "Missed", color: "var(--c4)" },
                ]} />
            </div>
          </div>
          <Link href={`/calls?${s.slice(1)}`} className="relative mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors duration-150 hover:bg-white/25">
            See every call <span aria-hidden>→</span>
          </Link>
        </section>

        <Card title="Speed to lead">
          <p className="-mt-2 mb-2 text-xs text-fg-3">Call end → designer&apos;s inbox · target under {target} min</p>
          <div className="flex flex-col items-center text-center">
            <Gauge value={ai.medianHandoffMin} max={target * 2}
              label={ai.medianHandoffMin === null ? "—" : `${ai.medianHandoffMin}m`}
              caption={ai.medianHandoffMin === null ? "No handoffs yet" : `Median ${ai.medianHandoffMin} minutes from call end to handoff`} />
            <p className="mt-1 text-sm text-fg-2">
              {ai.medianHandoffMin === null ? "No handoff sent yet — this fills in after the first qualified call." : ai.medianHandoffMin <= target ? "Median handoff time — on target." : "Median handoff time — slower than target."}
            </p>
            <p className="mt-3 rounded-xl bg-sage-soft px-3 py-2 text-xs text-sage-deep">Callers answered within 1 hour convert 4× better (case data).</p>
          </div>
        </Card>
      </div>

      {/* Row 2 — KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Calls" value={c.calls} icon={I.phone} delta={{ now: c.calls, before: p.calls }} href={`/calls?${s.slice(1)}`} />
        <Kpi label="Qualified" value={c.qualified} icon={I.check} delta={{ now: c.qualified, before: p.qualified }} href={`/calls?status=qualified${s}`} />
        <Kpi label="Fit rate" value={fitRate === null ? "—" : `${fitRate}%`} icon={I.cal} note={fitRate === null ? "No completed calls this week" : "Qualified ÷ completed calls"} />
        <Kpi label="Escalations" value={c.escalations} icon={I.alert} delta={{ now: c.escalations, before: p.escalations, goodWhenUp: false }} href={`/calls?status=escalation${s}`} />
      </div>

      {/* Row 3 — decision queue + outcome mix */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={<>Needs your decision {queue.length > 0 && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">{queue.length}</span>}</>}
          aside={queue.length > 4 ? <Link href={`/review?source=${source}`} className="font-semibold text-accent hover:underline">View all →</Link> : "Escalations stay for 3 days"}>
          {queue.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-sage-soft px-4 py-5 text-sm text-sage-deep">
              <span aria-hidden className="text-lg">✓</span>
              {o.calls === 0 ? "Nothing yet — calls appear here after Vaani sends them." : "All clear. Every call is handed off or closed by the rules."}
            </div>
          ) : <QueueList items={queue.slice(0, 4)} />}
        </Card>

        <Card title="Outcome mix" aside="All time">
          {mix.length === 0 ? <p className="py-6 text-sm text-fg-3">No calls yet.</p> : (
            <Donut label={String(mix.reduce((t, m) => t + m.count, 0))} sublabel="enquiries"
              parts={["qualified", "needs_review", "incomplete", "escalation", "not_qualified", "missed"]
                .map((k) => ({ label: STATUS_LABEL[k], value: mix.find((m) => m.status === k)?.count ?? 0, color: MIX_COLOR[k] }))
                .filter((x) => x.value > 0)} />
          )}
        </Card>
      </div>

      {/* Row 4 — recent calls + AI & cost */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Recent calls" aside={<Link href={`/calls?${s.slice(1)}`} className="font-semibold text-accent hover:underline">All calls →</Link>}>
          {recent.length === 0 ? <Empty>No calls yet. Make a test call in Vaani — it appears here about a minute after it ends.</Empty> : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Six most recent calls</caption>
                <thead className="text-left text-xs text-fg-3">
                  <tr>{["Caller", "When", "Length", "Status"].map((h) => <th key={h} scope="col" className="px-5 pb-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <Link href={`/calls/${r.id}`} className="font-medium text-fg hover:text-accent hover:underline">{r.caller_name ?? r.caller_number ?? "Unknown caller"}</Link>
                        <div className="text-xs text-fg-3">{r.area ?? (r.source === "replay" ? "Practice replay" : "")}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-fg-2">{r.started_at ? new Date(r.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-5 py-3 tabular-nums text-fg-2">{dur(r.duration_sec)}</td>
                      <td className="px-5 py-3"><StatusBadge status={r.processed || r.call_outcome !== "completed" ? r.status : null} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="AI & running cost" aside="Estimates labelled">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-fg-2">Calls the AI read cleanly</dt>
              <dd className="font-semibold tabular-nums">{ai.enquiries ? `${Math.round((ai.extractedOk / ai.enquiries) * 100)}%` : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-fg-2">Prices spoken by the agent <span className="text-fg-3">(must be 0)</span></dt>
              <dd className={`font-semibold tabular-nums ${ai.priceIncidents ? "text-danger" : "text-ok"}`}>{ai.priceIncidents}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-fg-2">Your overrides</dt><dd className="font-semibold tabular-nums">{ai.overridden}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-fg-2">Emails / Telegram delivered</dt>
              <dd className="font-semibold tabular-nums">{ai.deliveredPct === null ? "—" : `${ai.deliveredPct}%`}</dd></div>
            <div className="border-t border-line pt-3" />
            <div className="flex justify-between gap-3"><dt className="text-fg-2">Vaani <span className="text-fg-3">({o.vaaniMinutes} min × ₹{vaaniRate ?? "?"})</span></dt>
              <dd className="font-semibold tabular-nums">{o.vaaniCostInr === null ? "Unknown" : `₹${o.vaaniCostInr.toLocaleString("en-IN")}`}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-fg-2">Gemini <span className="text-fg-3">({o.geminiTokens.toLocaleString("en-IN")} tokens)</span></dt>
              <dd className="font-semibold tabular-nums">{o.geminiCostInr === null ? "Price not set" : `₹${o.geminiCostInr}`}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-fg-2">Per completed call</dt>
              <dd className="font-semibold tabular-nums">{costPerCall === null ? "—" : `≈ ₹${costPerCall}`}</dd></div>
          </dl>
          <div className="mt-4"><ButtonLink href="/system">How it works →</ButtonLink></div>
        </Card>
      </div>
    </div>
  );
}
