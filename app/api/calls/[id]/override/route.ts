// Founder's manual status override (the final call on review items). Re-runs outputs:
// overriding to qualified creates the HubSpot deal + handoff; to escalation sends the urgent email.
import { NextResponse } from "next/server";
import { getDeps } from "@/lib/deps";
import { runOutputs } from "@/lib/pipeline";
import { STATUSES, type Status } from "@/lib/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const form = await req.formData();
  const status = String(form.get("status") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const back = new URL(`/calls/${id}`, req.url);
  if (!(STATUSES as readonly string[]).includes(status) && status !== "clear") {
    back.searchParams.set("error", "Pick a status");
    return NextResponse.redirect(back, 303);
  }
  if (status !== "clear" && reason.length < 3) {
    back.searchParams.set("error", "A reason is required");
    return NextResponse.redirect(back, 303);
  }
  const deps = getDeps({ fake: true }); // no extraction happens here; fake avoids needing Gemini
  const call = await deps.store.getCall(Number(id));
  if (!call?.enquiry_id) {
    back.searchParams.set("error", "This call has no enquiry to override");
    return NextResponse.redirect(back, 303);
  }
  const enquiry = await deps.store.updateEnquiry(call.enquiry_id, status === "clear"
    ? { override_status: null, override_reason: null }
    : { override_status: status as Status, override_reason: reason });
  await deps.store.addAudit({ enquiry_id: enquiry.id, call_id: call.id, actor: "founder", action: status === "clear" ? "override_cleared" : "override", detail: { status, reason } });
  if (call.source === "live") await runOutputs(deps, enquiry, call);
  else await runOutputs({ ...deps, channels: null, hubspot: null }, enquiry, call);
  back.searchParams.set("saved", "1");
  return NextResponse.redirect(back, 303);
}
