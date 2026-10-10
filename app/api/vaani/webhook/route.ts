// Vaani post-call webhook. We only trust it as a trigger: read the call id, then fetch
// the call ourselves from Vaani. If anything fails, /api/sync picks the call up later.
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { getDeps, getVaani } from "@/lib/deps";
import { env } from "@/lib/env";
import { processVaaniCall } from "@/lib/sync";
import { callIdOf, isOurAgent } from "@/lib/vaani";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request, secret: string): boolean {
  const url = new URL(req.url);
  const candidates = [
    req.headers.get("x-webhook-secret"),
    req.headers.get("x-vaani-secret"),
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""),
    url.searchParams.get("secret"),
  ];
  return candidates.some((c) => c && safeEqual(c, secret));
}

export async function POST(req: Request) {
  const e = env();
  if (!e.vaaniWebhookSecret) return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  if (!authorized(req, e.vaaniWebhookSecret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const callId = body ? callIdOf(body) : null;
  if (!body || !callId) return NextResponse.json({ error: "no call id in payload" }, { status: 400 });
  if (!isOurAgent(body, e.vaaniAgentId)) return NextResponse.json({ ignored: "other agent" });

  const deps = getDeps();
  try {
    const r = await processVaaniCall(deps, getVaani(e), callId);
    if ("notReady" in r) return NextResponse.json({ accepted: true, note: "transcript not ready; sync will retry" }, { status: 202 });
    return NextResponse.json({ ok: !r.error, callId, status: r.status, skipped: r.skipped });
  } catch (err) {
    await deps.store.addPipelineError({ call_id: null, step: "webhook", message: `${callId}: ${(err as Error).message}` });
    return NextResponse.json({ error: "processing failed; will retry via sync" }, { status: 500 });
  }
}
