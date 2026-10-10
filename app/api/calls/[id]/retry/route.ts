// Recovery path for a call that stopped retrying after MAX_ATTEMPTS failures. Founder action.
import { NextResponse } from "next/server";
import { getDeps, getVaani } from "@/lib/deps";
import { processCall } from "@/lib/pipeline";
import { processVaaniCall } from "@/lib/sync";

export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const back = new URL(`/calls/${id}`, req.url);
  const stored = await getDeps({ fake: true, dryRun: true }).store.getCall(Number(id));
  if (!stored) return NextResponse.redirect(new URL("/calls", req.url), 303);
  const isLive = stored.source === "live";

  try {
    const deps = isLive ? getDeps() : getDeps({ fake: true, dryRun: true });
    await deps.store.resetAttempts(stored.id);
    await deps.store.addAudit({ call_id: stored.id, actor: "founder", action: "retry" });
    const r = isLive
      ? await processVaaniCall(deps, getVaani(), stored.vaani_call_id)
      : await processCall(deps, {
          vaaniCallId: stored.vaani_call_id, source: "replay", callerNumber: stored.caller_number, startedAt: stored.started_at,
          durationSec: stored.duration_sec, outcome: stored.call_outcome, transcript: stored.transcript,
        }, { fixtureId: stored.vaani_call_id.replace(/^replay-/, "") });
    if ("notReady" in r) back.searchParams.set("notice", "Vaani has no transcript for this call yet. Try again in a few minutes.");
    else if (r.error) back.searchParams.set("notice", `Retry failed again: ${r.error.slice(0, 160)}`);
    else back.searchParams.set("notice", "Processed.");
  } catch (err) {
    back.searchParams.set("notice", `Retry failed: ${(err as Error).message.slice(0, 160)}`);
  }
  return NextResponse.redirect(back, 303);
}
