// Daily digest to the founder (Vercel cron, once a day — the Hobby plan limit).
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth";
import { getChannels, getStore } from "@/lib/deps";
import { deliver } from "@/lib/notify";
import { overview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const since = new Date(Date.now() - 24 * 3600_000);
  const o = await overview({ from: since.toISOString(), source: "live" });
  const text = [
    `Last 24 hours (live calls only):`,
    `Calls: ${o.calls} · Completed: ${o.completed} · Missed/dropped: ${o.missed}`,
    `Qualified: ${o.qualified} · Needs review: ${o.needsReview} · Escalations: ${o.escalations}`,
    `Booked in call: ${o.booked} · Delivery failures: ${o.deliveryFailures}`,
    `Cost estimate: Vaani ₹${o.vaaniCostInr ?? "unknown"} · Gemini ₹${o.geminiCostInr ?? "unknown (price not set)"}`,
  ].join("\n");
  const ok = await deliver(getStore(), getChannels(), { kind: "digest", enquiryId: null, callId: null, subject: "[Aangan] Daily enquiry digest", text });
  return NextResponse.json({ delivered: ok });
}
