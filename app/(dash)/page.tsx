// Overview. One job: show the founder what needs a decision, then how the desk is doing.
import Link from "next/link";
import { Donut, Gauge, StackedBars } from "@/components/charts";
import { Courtyard } from "@/components/Courtyard";
import { QueueList } from "@/components/QueueList";
import { SourceTabs } from "@/components/SourceTabs";
import { Card, dur, Empty, Kpi, StatusBadge } from "@/components/ui";
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

  const strip: [string, string, string, string][] = [
    ["Read cleanly by AI", ai.enquiries ? `${Math.round((ai.extractedOk / ai.enquiries) * 100)}%` : "—", "calls the AI understood", ""],
    ["Prices spoken", String(ai.priceIncidents), "must stay 0", ai.priceIncidents ? "text-danger" : "text-ok"],
    ["Your overrides", String(ai.overridden), "decisions you changed", ""],
    ["Delivered", ai.deliveredPct === null ? "—" : `${ai.deliveredPct}%`, "email / Telegram", ""],
    ["Vaani (est.)", o.vaaniCostInr === null ? "—" : `₹${o.vaaniCostInr.toLocaleString("en-IN")}`, `${o.vaaniMinutes} min × ₹${vaaniRate ?? "?"}`, ""],
    ["Per call (est.)", costPerCall === null ? "—" : `₹${costPerCall}`, o.geminiCostInr === null ? "Gemini price not set" : `Gemini ₹${o.geminiCostInr}`, ""],
  ];

  return (
    <div className="space-y-7">
      {/* Header — greeting, date chip, data source */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Aangan Studio · Enquiry desk</p>
          <h1 className="font-display mt-2 text-[34px] font-semibold leading-[1.05] tracking-tight sm:text-[44px]">{greeting()}, Nikhil</h1>
          <p className="mt-1 text-sm text-fg-2">Here&apos;s how the phone enquiries are going.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm text-fg-2">
            {I.cal}{ist({ weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
          <SourceTabs source={source} base="/" />
        </div>
      </div>

      {source !== "live" && (
        <p className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-fg-2">
          You&apos;re looking at {source === "replay" ? "practice replays (test data from the case transcripts)" : "live calls and practice replays together"}. Practice replays send no emails and create no deals.
        </p>
      )}

      {/* Row 1 — hero + speed to lead */}
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card xl:col-span-2">
          <div className="grid md:grid-cols-[1.05fr_1fr]">
            {/* Left — the headline number */}
            <div className="flex flex-col p-6 sm:p-8">
              <p className="eyebrow">Enquiry calls · last 7 days</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <p className="font-display text-[76px] font-semibold leading-[0.85] tabular-nums text-fg">{c.calls}</p>
                {p.calls > 0 || c.calls > 0 ? (
                  <span className="mb-2 inline-flex items-center rounded-full bg-sage-soft px-2.5 py-1 text-xs font-semibold text-forest">
                    {p.calls === 0 ? "New this week" : `${c.calls >= p.calls ? "↑" : "↓"} ${Math.abs(Math.round(((c.calls - p.calls) / p.calls) * 100))}% vs last week`}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 max-w-xs text-sm text-fg-2">
                {c.calls === 0
                  ? source === "replay" ? "Practice replays are dated September, so this week is empty." : "No calls this week yet. A test call lands here about a minute after it ends."
                  : `${c.completed} completed · ${c.calls - c.completed} missed or dropped`}
              </p>
              <dl className="mt-auto grid grid-cols-3 gap-2.5 pt-7">
                {([["Qualified", c.qualified], ["Booked", c.booked], ["Talk time", `${Math.round(c.seconds / 60)}m`]] as const).map(([k, v]) => (
                  <div key={k} className="rounded-2xl border border-line bg-surface-2 px-3.5 py-3">
                    <dt className="text-xs text-fg-3">{k}</dt>
                    <dd className="font-display mt-1 text-2xl font-semibold tabular-nums text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Right — forest panel: the week at a glance */}
            <div className="relative flex flex-col overflow-hidden bg-forest p-6 text-on-forest sm:p-8">
              <Courtyard tone="dark" className="pointer-events-none absolute -right-16 -top-10 w-[105%] max-w-[480px] opacity-40" />
              <div className="relative flex items-baseline justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">This week</p>
                <p className="text-xs text-white/75">Calls per day</p>
              </div>
              <div className="relative mt-auto pt-10">
                <StackedBars tone="dark" height={150} caption="Calls per day for the last 7 days, by outcome"
                  data={days.map((d) => ({ label: d.label, values: { qualified: d.qualified, review: d.review, notFit: d.notFit, missed: d.missed } }))}
                  series={[
                    { key: "qualified", label: "Qualified", color: "#cfd8c3" },
                    { key: "review", label: "Needs a person", color: "#d9c9ae" },
                    { key: "notFit", label: "Not a fit", color: "rgb(255 255 255 / 0.38)" },
                    { key: "missed", label: "Missed", color: "#a9b8c3" },
                  ]} />
                <Link href={`/calls?${s.slice(1)}`}
                  className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-forest transition-colors duration-150 hover:bg-[#f1f3ec]">
                  See every call <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col rounded-3xl border border-line bg-beige p-6 sm:p-7">
          <p className="eyebrow">Speed to lead</p>
          <p className="mt-1 text-xs text-fg-3">Call end → designer&apos;s inbox · target under {target} min</p>
          <div className="mt-3 flex flex-col items-center text-center">
            <Gauge value={ai.medianHandoffMin} max={target * 2}
              label={ai.medianHandoffMin === null ? "—" : `${ai.medianHandoffMin}m`}
              caption={ai.medianHandoffMin === null ? "No handoffs yet" : `Median ${ai.medianHandoffMin} minutes from call end to handoff`} />
            <p className="mt-1 text-sm text-fg-2">
              {ai.medianHandoffMin === null ? "Fills in after the first qualified call." : ai.medianHandoffMin <= target ? "Median handoff time — on target." : "Median handoff time — slower than target."}
            </p>
          </div>
          <p className="mt-auto rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-xs leading-relaxed text-fg-2">
            Callers answered within an hour convert <b className="text-fg">4×</b> better (case data).
          </p>
        </section>
      </div>

      {/* Row 2 — KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Calls" value={c.calls} icon={I.phone} delta={{ now: c.calls, before: p.calls }} href={`/calls?${s.slice(1)}`} />
        <Kpi label="Qualified" value={c.qualified} icon={I.check} delta={{ now: c.qualified, before: p.qualified }} href={`/calls?status=qualified${s}`} />
        <Kpi label="Fit rate" value={fitRate === null ? "—" : `${fitRate}%`} icon={I.cal} note={fitRate === null ? "No completed calls this week" : "Qualified ÷ completed calls"} />
        <Kpi label="Escalations" value={c.escalations} icon={I.alert} delta={{ now: c.escalations, before: p.escalations, goodWhenUp: false }} href={`/calls?status=escalation${s}`} />
      </div>

      {/* Row 3 — decision queue + outcome mix */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={<>Needs your decision {queue.length > 0 && <span className="ml-1 rounded-full bg-forest px-2 py-0.5 text-xs text-on-forest">{queue.length}</span>}</>}
          aside={queue.length > 4 ? <Link href={`/review?source=${source}`} className="font-semibold text-accent hover:underline">View all →</Link> : "Escalations stay for 3 days"}>
          {queue.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-5 text-sm text-fg-2">
              <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sage-soft text-sage-deep">✓</span>
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

      {/* Row 4 — recent calls */}
      <div>
        <Card title="Recent calls" aside={<Link href={`/calls?${s.slice(1)}`} className="font-semibold text-accent hover:underline">All calls →</Link>}>
          {recent.length === 0 ? <Empty>No calls yet. Make a test call in Vaani — it appears here about a minute after it ends.</Empty> : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Six most recent calls</caption>
                <thead className="text-left text-xs text-fg-3">
                  <tr className="border-b border-line">{["Caller", "When", "Length", "Status"].map((h) => <th key={h} scope="col" className="px-5 pb-2.5 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent.map((r) => (
                    <tr key={r.id} className="transition-colors duration-150 hover:bg-surface-2">
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

      </div>

      {/* Row 5 — AI quality and running cost */}
      <section className="rounded-3xl border border-line bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">AI quality &amp; running cost</h2>
          <Link href="/system" className="text-xs font-semibold text-accent hover:underline">How it works →</Link>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-6">
          {strip.map(([k, v, note, cls]) => (
            <div key={k} className="border-l border-line pl-4">
              <dt className="text-xs text-fg-3">{k}</dt>
              <dd className={`font-display mt-1 text-2xl font-semibold tabular-nums ${cls || "text-fg"}`}>{v}</dd>
              <dd className="mt-0.5 text-xs text-fg-3">{note}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
