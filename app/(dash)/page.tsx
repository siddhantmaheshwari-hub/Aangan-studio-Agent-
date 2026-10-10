// Overview. One job: show the founder what needs a decision now; numbers come second.
import Link from "next/link";
import { env } from "@/lib/env";
import { ruleTitle } from "@/lib/labels";
import { actionQueue, overview, type QueueItem, recentErrors } from "@/lib/queries";
import { ago, Card, Empty, Flag, IST, iso } from "@/components/ui";

const KIND: Record<QueueItem["kind"], { label: string; cls: string; action: string }> = {
  escalation: { label: "Escalation", cls: "bg-danger-bg text-danger", action: "Call the client back" },
  not_delivered: { label: "Email not delivered", cls: "bg-danger-bg text-danger", action: "Follow up by hand" },
  stuck: { label: "Processing failed", cls: "bg-warn-bg text-warn", action: "Open and retry" },
  needs_review: { label: "Needs review", cls: "bg-warn-bg text-warn", action: "Decide" },
  incomplete: { label: "Incomplete", cls: "bg-info-bg text-info", action: "Call back for details" },
};

function SourceTabs({ source }: { source: string }) {
  const tabs = [["live", "Live calls"], ["replay", "Fixture replays"], ["all", "All"]];
  return (
    <nav aria-label="Data source" className="flex gap-1 text-sm">
      {tabs.map(([x, label]) => (
        <Link key={x} href={`/?source=${x}`} aria-current={source === x ? "page" : undefined}
          className={`inline-flex min-h-9 items-center rounded-md px-3 ${source === x ? "bg-fg text-bg" : "border border-line bg-surface hover:bg-surface-2"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Stat({ label, value, note, href }: { label: string; value: string | number; note?: string; href?: string }) {
  const inner = (
    <>
      <dt className="text-xs text-fg-3">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-fg-3">{note}</dd>}
    </>
  );
  return href
    ? <Link href={href} className="block rounded-md p-2 hover:bg-surface-2">{inner}</Link>
    : <div className="p-2">{inner}</div>;
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const { source = "live" } = await searchParams;
  const [o, queue, errors] = await Promise.all([overview({ source }), actionQueue(source), recentErrors(5)]);
  const e = env();
  const s = `&source=${source}`;
  const sameInbox = !e.handoffTo || e.handoffTo === e.founderEmail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-fg-3">As of {IST(new Date().toISOString())} IST · reload for the latest</p>
        </div>
        <SourceTabs source={source} />
      </div>

      <Card title={`Needs your decision${queue.length ? ` (${queue.length})` : ""}`} aside="Escalations stay here for 3 days">
        {queue.length === 0 ? (
          <p className="py-3 text-sm text-fg-2">
            {o.calls === 0 ? "Nothing yet — calls appear here after Vaani sends them." : "Nothing is waiting. Every call is either handed off or closed by the rules."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {queue.map((q) => {
              const k = KIND[q.kind];
              return (
                <li key={`${q.kind}-${q.callId}`}>
                  <Link href={`/calls/${q.callId}`} className="-mx-2 flex flex-wrap items-start gap-x-4 gap-y-1 rounded-md px-2 py-3 hover:bg-surface-2">
                    <span className={`mt-0.5 w-36 shrink-0 rounded px-2 py-0.5 text-center text-xs font-semibold ${k.cls}`}>{k.label}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{q.name ?? q.phone ?? "Unknown caller"}</span>
                      {q.area && <span className="text-fg-2"> · {q.area}</span>}
                      <span className="block text-sm text-fg-2">
                        {q.detail ?? (q.ruleIds.length ? q.ruleIds.map(ruleTitle).join(" · ") : q.summary)}
                      </span>
                      {q.flags.includes("price_figure_spoken") && <span className="mt-1 block"><Flag name="price_figure_spoken" /></span>}
                    </span>
                    <span className="shrink-0 text-right text-xs text-fg-3">
                      {ago(q.at)}
                      <span className="mt-1 block font-semibold text-accent">{k.action} →</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {o.calls === 0 ? (
        <Empty>No {source === "live" ? "live " : source === "replay" ? "replayed " : ""}calls yet. They appear after Vaani&apos;s post-call webhook or the next sync (every 15 min).</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Calls">
            <dl className="grid grid-cols-2">
              <Stat label="All calls" value={o.calls} href={`/calls?${s.slice(1)}`} />
              <Stat label="Completed" value={o.completed} note={`${o.missed} missed or dropped`} />
            </dl>
          </Card>
          <Card title="Outcomes" aside="PROXY rules">
            <dl className="grid grid-cols-2">
              <Stat label="Qualified" value={o.qualified} href={`/calls?status=qualified${s}`} />
              <Stat label="Booked in call" value={o.booked} note="per transcript" href={`/calls?flag=booked${s}`} />
              <Stat label="Needs review" value={o.needsReview} href={`/calls?status=needs_review${s}`} />
              <Stat label="Escalations" value={o.escalations} href={`/calls?status=escalation${s}`} />
            </dl>
          </Card>
          <Card title="Delivery & speed">
            <dl className="grid grid-cols-2">
              <Stat label="Not delivered" value={o.deliveryFailures} note="handoff / urgent emails" />
              <Stat label="Call end → handoff" value={o.medianHandoffMin === null ? "—" : `${o.medianHandoffMin} min`} note={o.medianHandoffMin === null ? "no handoff sent yet" : "median"} />
              <Stat label="Pipeline errors" value={o.pipelineErrors} />
            </dl>
          </Card>
          <Card title="Cost" aside="Estimates" className="lg:col-span-3">
            <dl className="grid grid-cols-2 sm:grid-cols-3">
              <Stat label="Vaani (live calls only)" value={o.vaaniCostInr === null ? "Unknown" : `₹${o.vaaniCostInr.toLocaleString("en-IN")}`}
                note={`${o.vaaniMinutes} min × ₹${e.vaaniCostPerMinInr ?? "?"}/min course rate`} />
              <Stat label="Gemini" value={o.geminiCostInr === null ? "Unknown" : `₹${o.geminiCostInr}`}
                note={o.geminiCostInr === null ? `${o.geminiTokens.toLocaleString("en-IN")} tokens; set the per-token price to estimate` : `${o.geminiTokens.toLocaleString("en-IN")} tokens · ${o.geminiCalls} model calls`} />
            </dl>
          </Card>
        </div>
      )}

      {errors.length > 0 && (
        <Card title="Recent problems" aside="Latest 5, all sources" tone="danger">
          <ul className="space-y-1 text-sm">
            {errors.map((er, i) => (
              <li key={i} className="text-fg-2">
                <span className="text-fg-3">{IST(iso(er.created_at))}</span> <b className="text-fg">{String(er.step)}</b> — {String(er.message).slice(0, 220)}{" "}
                {er.call_id ? <Link className="text-accent underline" href={`/calls/${er.call_id}`}>open call</Link> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <aside className="rounded-lg bg-surface-2 p-4 text-sm text-fg-2">
        <h2 className="font-semibold text-fg">How to read this</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The status is set by fixed rules in code, not by AI. Rules are <b>PROXY</b> until Nikhil&apos;s qualified.md / services.md arrive.</li>
          <li>Nothing is declined for a borderline case — it comes to you as <b>Needs review</b>, and your decision is final.</li>
          <li>
            {!(e.telegramToken && e.telegramChatId)
              ? "Telegram is off (no bot token or chat id) — alerts go by email only."
              : e.telegramMode === "always"
                ? "Every handoff, escalation and alert goes to both email and the team's Telegram; either one counts as delivered."
                : "Telegram is the fallback: it is used only when an email fails twice."}
          </li>
          {sameInbox && <li>All emails currently go to the founder&apos;s address (Resend without a verified domain only sends to the account owner).</li>}
          <li>Fixture replays are test data: no recording, no Vaani cost, no emails or HubSpot deals.</li>
        </ul>
      </aside>
    </div>
  );
}
