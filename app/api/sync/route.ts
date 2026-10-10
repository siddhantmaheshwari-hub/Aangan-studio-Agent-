// Polling fallback, called every 15 min by GitHub Actions with Authorization: Bearer CRON_SECRET.
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth";
import { getDeps, getStore, getVaani } from "@/lib/deps";
import { env } from "@/lib/env";
import { syncFromVaani } from "@/lib/sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const e = env();
  // The store is built first and on its own, so a missing key elsewhere is still recorded and shown.
  let store;
  try {
    store = getStore(e);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  try {
    const summary = await syncFromVaani(getDeps({ store }, e), getVaani(e), e.vaaniAgentId, 40_000);
    await store.setState("last_sync_ok", new Date().toISOString());
    return NextResponse.json(summary);
  } catch (err) {
    const message = (err as Error).message;
    await store.setState("last_sync_error", `${new Date().toISOString()} ${message}`).catch(() => {});
    await store.addPipelineError({ call_id: null, step: "sync", message }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
