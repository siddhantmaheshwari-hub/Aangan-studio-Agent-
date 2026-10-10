// Streams a call recording from Vaani. The Vaani key stays on the server; middleware checks the login.
import { getStore, getVaani } from "@/lib/deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const call = await getStore().getCall(Number(id));
  if (!call) return new Response("not found", { status: 404 });
  if (call.source !== "live") return new Response("fixture replays have no recording", { status: 404 });
  const upstream = await getVaani().stream(call.vaani_call_id, req.headers.get("range"));
  if (!upstream.ok || !upstream.body) return new Response(`recording unavailable (HTTP ${upstream.status})`, { status: 502 });
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "audio/mpeg");
  return new Response(upstream.body, { status: upstream.status, headers });
}
