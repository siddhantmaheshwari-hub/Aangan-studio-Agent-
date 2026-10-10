import Link from "next/link";
import { env } from "@/lib/env";
import { overview, recentErrors } from "@/lib/queries";
import { IST } from "@/components/ui";

function Tile({ label, value, note, href }: { label: string; value: string | number; note?: string; href?: string }) {
  const body = (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {note && <div className="mt-1 text-xs text-stone-500">{note}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:ring-2 hover:ring-stone-300 rounded-lg">{body}</Link> : body;
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const { source = "live" } = await searchParams;
  const [o, errors] = await Promise.all([overview({ source }), recentErrors(5)]);
  const e = env();
  const s = `&source=${source}`;
  const sameInbox = !e.handoffTo || e.handoffTo === e.founderEmail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Overview</h1>
        <div className="flex gap-1 text-sm">
          {["live", "replay", "all"].map((x) => (
            <Link key={x} href={`/?source=${x}`} className={`rounded px-3 py-1 ${source === x ? "bg-stone-900 text-white" : "border border-stone-300 bg-white"}`}>
              {x === "live" ? "Live calls" : x === "replay" ? "Fixture replays" : "All"}
            </Link>
          ))}
        </div>
      </div>

      {o.calls === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
          No {source === "all" ? "" : source === "live" ? "live " : "replayed "}calls yet. Calls appear here after Vaani sends the post-call webhook or the next sync runs.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Tile label="Calls" value={o.calls} href={`/calls?${s.slice(1)}`} />
          <Tile label="Completed" value={o.completed} note={`${o.missed} missed / dropped`} />
          <Tile label="Qualified" value={o.qualified} href={`/calls?status=qualified${s}`} />
          <Tile label="Needs review" value={o.needsReview} href={`/calls?status=needs_review${s}`} />
          <Tile label="Escalations" value={o.escalations} href={`/calls?status=escalation${s}`} />
          <Tile label="Booked in call" value={o.booked} href={`/calls?flag=booked${s}`} note="per call transcript" />
          <Tile label="Delivery failures" value={o.deliveryFailures} note="handoff / urgent emails not delivered" />
          <Tile label="Median call end → handoff" value={o.medianHandoffMin === null ? "—" : `${o.medianHandoffMin} min`} note={o.medianHandoffMin === null ? "no handoffs delivered yet" : undefined} />
          <Tile label="Vaani cost (estimate)" value={o.vaaniCostInr === null ? "unknown" : `₹${o.vaaniCostInr}`} note={`${o.vaaniMinutes} min × ₹${e.vaaniCostPerMinInr ?? "?"}/min course rate`} />
          <Tile
            label="Gemini cost (estimate)"
            value={o.geminiCostInr === null ? "unknown" : `₹${o.geminiCostInr}`}
            note={o.geminiCostInr === null ? `${o.geminiTokens.toLocaleString("en-IN")} tokens; price per token not configured` : `${o.geminiTokens.toLocaleString("en-IN")} tokens, ${o.geminiCalls} model calls`}
          />
          <Tile label="Pipeline errors" value={o.pipelineErrors} />
        </div>
      )}

      <section className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <h2 className="font-medium">Notes</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
          <li>Qualification rules are <b>PROXY</b> rules until Nikhil&apos;s qualified.md / services.md arrive.</li>
          {sameInbox && <li>All emails currently go to the founder&apos;s address (Resend without a verified domain can only send to the account owner).</li>}
          <li>Costs are estimates. Fixture replays have no Vaani minutes cost and no recording.</li>
        </ul>
      </section>

      {errors.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-white p-4 text-sm">
          <h2 className="font-medium text-red-900">Recent pipeline errors</h2>
          <ul className="mt-2 space-y-1">
            {errors.map((er, i) => (
              <li key={i} className="text-stone-700">
                <span className="text-stone-500">{IST(er.created_at instanceof Date ? er.created_at.toISOString() : String(er.created_at))}</span>{" "}
                <b>{String(er.step)}</b> — {String(er.message).slice(0, 200)}{" "}
                {er.call_id ? <Link className="underline" href={`/calls/${er.call_id}`}>call</Link> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
