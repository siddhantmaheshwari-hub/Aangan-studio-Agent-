// Health ping, called by GitHub Actions with Bearer CRON_SECRET. Alerts the founder (at most every 2 h) when unhealthy.
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth";
import { getChannels, getStore } from "@/lib/deps";
import { checkHealth } from "@/lib/health";
import { deliver } from "@/lib/notify";

export const dynamic = "force-dynamic";
const ALERT_EVERY_MS = 2 * 60 * 60_000;
const SYNC_STALE_MS = 45 * 60_000;

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const h = await checkHealth();
  const problems: string[] = [];
  if (!h.neon.ok) problems.push(`Neon: ${h.neon.detail}`);
  if (!h.vaani.ok) problems.push(`Vaani: ${h.vaani.detail}`);
  if (h.lastSyncOk && Date.now() - Date.parse(h.lastSyncOk) > SYNC_STALE_MS) problems.push(`Last successful sync ${h.lastSyncOk}`);

  if (problems.length && h.neon.ok) {
    const store = getStore();
    const last = await store.getState("last_health_alert");
    if (!last || Date.now() - Date.parse(last) > ALERT_EVERY_MS) {
      await deliver(store, getChannels(), { kind: "system_alert", enquiryId: null, callId: null, subject: "[Aangan] Health check failing", text: problems.join("\n") });
      await store.setState("last_health_alert", new Date().toISOString());
    }
  }
  return NextResponse.json({ ok: problems.length === 0, problems, ...h }, { status: problems.length ? 503 : 200 });
}
