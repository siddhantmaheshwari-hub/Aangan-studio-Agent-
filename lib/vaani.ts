// Vaani REST client (header X-API-Key). Field names follow https://docs.vaanivoice.ai
//   GET /api/call-history?page&page_size → { data: [call], pagination }   (caller number, times, status)
//   GET /api/call_details/{id}           → { transcription, entity, summary, call_eval_tag }
//   GET /api/transcript/{id}             → { transcript, status_code }
//   GET /api/stream/{id}                 → audio (ogg/mpeg)
//   Webhook event "call_postprocessing"  → { call_id, timestamp, data: { transcript, summary, call_duration (ms) } }
// The raw payloads are kept in calls.raw so the mapping can be checked against real calls.
import type { CallOutcome, IncomingCall, Speaker, Turn } from "./types";

type Json = Record<string, unknown>;

export interface VaaniClient {
  health(): Promise<{ ok: boolean; detail: string }>;
  callHistory(page?: number, pageSize?: number): Promise<Json[]>;
  /** The call-history row for one call (the only place with caller number and times). */
  findInHistory(callId: string, maxPages?: number): Promise<Json | null>;
  callDetails(callId: string): Promise<Json>;
  transcript(callId: string): Promise<unknown>;
  stream(callId: string, range?: string | null): Promise<Response>;
}

export function vaaniClient(baseUrl: string, apiKey: string): VaaniClient {
  const url = (p: string) => `${baseUrl.replace(/\/$/, "")}${p}`;
  const headers = { "X-API-Key": apiKey, Accept: "application/json" };
  async function get(p: string): Promise<unknown> {
    const res = await fetch(url(p), { headers, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let message = body.slice(0, 200);
      try {
        message = (JSON.parse(body) as { message?: string }).message ?? message;
      } catch {}
      throw new Error(`Vaani GET ${p.split("?")[0]} → HTTP ${res.status}: ${message}`);
    }
    return res.json();
  }
  const client: VaaniClient = {
    async health() {
      try {
        const res = await fetch(url("/api/health"), { headers, signal: AbortSignal.timeout(5_000), cache: "no-store" });
        return { ok: res.ok, detail: `HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, detail: (err as Error).message };
      }
    },
    async callHistory(page = 1, pageSize = 50) {
      return listFrom(await get(`/api/call-history?page=${page}&page_size=${pageSize}`));
    },
    async findInHistory(callId, maxPages = 3) {
      for (let page = 1; page <= maxPages; page++) {
        const rows = await client.callHistory(page, 100);
        const hit = rows.find((r) => callIdOf(r) === callId);
        if (hit) return hit;
        if (rows.length < 100) break;
      }
      return null;
    },
    async callDetails(id) {
      return (await get(`/api/call_details/${encodeURIComponent(id)}`)) as Json;
    },
    async transcript(id) {
      try {
        return await get(`/api/transcript/${encodeURIComponent(id)}`);
      } catch (err) {
        if (/HTTP 404/.test((err as Error).message)) return null; // not generated yet
        throw err;
      }
    },
    async stream(id, range) {
      return fetch(url(`/api/stream/${encodeURIComponent(id)}`), {
        headers: { "X-API-Key": apiKey, ...(range ? { Range: range } : {}) },
        cache: "no-store",
      });
    },
  };
  return client;
}

/** Find the array of calls in the response envelope ({ data: [...] } per the docs). */
export function listFrom(body: unknown): Json[] {
  if (Array.isArray(body)) return body as Json[];
  const b = body as Json;
  for (const k of ["data", "calls", "results", "items"]) if (Array.isArray(b?.[k])) return b[k] as Json[];
  return [];
}

const pick = (o: unknown, keys: string[]): unknown => {
  const obj = o as Json | null | undefined;
  for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  return undefined;
};

export const callIdOf = (o: Json): string | null => {
  const v = pick(o, ["call_id", "callId"]) ?? pick(o?.data, ["call_id", "room_name"]) ?? pick(o, ["room_name", "id"]);
  return v === undefined ? null : String(v);
};

/** Strings Vaani returns instead of a transcript while post-processing is still running. */
const NOT_READY_TEXT = /not available for further evaluations|not found in azure|transcript not found/i;

const AGENT_ROLES = ["agent", "assistant", "bot", "ai"];
const roleOf = (r: unknown): Speaker => (AGENT_ROLES.includes(String(r ?? "").toLowerCase()) ? "AGENT" : "USER");

/**
 * Parses Vaani transcripts: "AGENT: …\n\n USER: …", optionally with "[13:33:14] " timestamps,
 * or a structured chat_history array. Lines without a speaker continue the previous turn.
 */
export function parseTranscript(t: unknown): Turn[] {
  if (!t) return [];
  if (typeof t === "string") {
    if (NOT_READY_TEXT.test(t)) return [];
    const turns: Turn[] = [];
    for (const raw of t.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^(?:\[[^\]]*\]\s*)?(agent|assistant|bot|user|caller|customer)\s*:\s*(.*)$/i);
      if (m) turns.push([roleOf(m[1]), m[2].trim()]);
      else if (turns.length) turns[turns.length - 1][1] += ` ${line}`;
    }
    return turns.filter(([, text]) => text.length > 0);
  }
  if (Array.isArray(t)) {
    return t
      .map((x): Turn | null => {
        const o = x as Json;
        const text = pick(o, ["content", "text", "message"]);
        return text === undefined ? null : [roleOf(pick(o, ["role", "speaker"])), String(text)];
      })
      .filter((x): x is Turn => Boolean(x && x[1].trim()));
  }
  return parseTranscript(pick(t, ["transcript", "transcription"]));
}

/** Vaani timestamps have no offset (e.g. "2026-04-21T12:27:23.335803"); its webhook uses UTC, so assume UTC. */
function toIso(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v);
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function outcomeOf(status: unknown, transcript: Turn[], durationSec: number | null): CallOutcome {
  const s = String(status ?? "").toLowerCase();
  const userTurns = transcript.filter(([sp]) => sp === "USER").length;
  if (/(no[-_ ]?answer|missed|rejected|busy|failed|error)/.test(s) && userTurns === 0) return "missed";
  if (userTurns === 0) return durationSec ? "disconnected" : "missed";
  // "User disconnected" is how most calls end; only a call that dropped almost at once is a dropped call.
  if (/disconnect|dropped/.test(s) && userTurns < 2) return "disconnected";
  return "completed";
}

export interface VaaniSources {
  history?: Json | null; // call-history row
  details?: Json | null; // /api/call_details
  transcript?: unknown; // /api/transcript
  webhook?: Json | null; // call_postprocessing payload
}

/** Is Vaani still post-processing this call (transcript not ready)? */
export function isNotReady(src: VaaniSources): boolean {
  const pp = String(pick(src.history, ["post_processing_status"]) ?? "");
  if (pp && pp !== "completed") return true;
  const details = pick(src.details, ["transcription"]);
  return !pp && typeof details === "string" && NOT_READY_TEXT.test(details) && !src.webhook;
}

/** Build an IncomingCall from whatever Vaani sources we have. */
export function toIncomingCall(callId: string, src: VaaniSources): IncomingCall {
  const h = src.history ?? {};
  const wh = (src.webhook?.data as Json | undefined) ?? {};
  const candidates = [src.transcript, pick(src.details, ["transcription"]), wh.transcript, h.chat_history];
  let transcript: Turn[] = [];
  for (const c of candidates) {
    transcript = parseTranscript(c);
    if (transcript.length) break;
  }

  const durMs = pick(h, ["duration_ms"]) ?? pick(wh, ["call_duration"]);
  const durationSec = durMs === undefined ? null : Math.round(Number(durMs) / 1000);
  const summary = pick(src.details, ["summary"]) ?? pick(h, ["call_summary"]) ?? pick(wh, ["summary"]);
  const number = pick(h, ["from_number"]) ?? pick(h.call_metadata, ["phone"]);
  const started = toIso(pick(h, ["Start_time", "start_time"])) ??
    (src.webhook?.timestamp && durationSec !== null ? new Date(Date.parse(String(src.webhook.timestamp)) - durationSec * 1000).toISOString() : toIso(src.webhook?.timestamp));

  return {
    vaaniCallId: callId,
    source: "live",
    callerNumber: number === undefined ? null : String(number),
    startedAt: started,
    durationSec,
    outcome: outcomeOf(pick(h, ["call_status"]) ?? pick(wh, ["end_reason"]), transcript, durationSec),
    transcript,
    summaryVaani: typeof summary === "string" && !NOT_READY_TEXT.test(summary) ? summary : null,
    raw: { history: src.history ?? null, details: src.details ?? null, transcript: src.transcript ?? null, webhook: src.webhook ?? null },
  };
}

/** Does this call belong to our agent? (No agent id configured or present → yes.) */
export function isOurAgent(o: Json, agentId: string | undefined): boolean {
  if (!agentId) return true;
  const a = pick(o, ["agent_id"]) ?? pick(o.call_metadata, ["agent_id"]);
  return a === undefined || String(a) === agentId;
}
