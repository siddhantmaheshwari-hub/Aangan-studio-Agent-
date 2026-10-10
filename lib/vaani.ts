// Vaani REST client (header X-API-Key). Endpoints per CLAUDE.md:
//   /api/call-history, /api/call_details/{id}, /api/transcript/{id}, /api/stream/{id}, /api/health
// Response field names are NOT documented publicly, so the mapping below accepts the common
// variants and keeps the raw payload in calls.raw. Verify against a real call (see README).
import type { CallOutcome, IncomingCall, Speaker, Turn } from "./types";

type Json = Record<string, unknown>;

export interface VaaniClient {
  health(): Promise<{ ok: boolean; detail: string }>;
  callHistory(): Promise<Json[]>;
  callDetails(callId: string): Promise<Json>;
  transcript(callId: string): Promise<unknown>;
  stream(callId: string, range?: string | null): Promise<Response>;
}

export function vaaniClient(baseUrl: string, apiKey: string): VaaniClient {
  const url = (p: string) => `${baseUrl.replace(/\/$/, "")}${p}`;
  const headers = { "X-API-Key": apiKey, Accept: "application/json" };
  async function get(p: string): Promise<unknown> {
    const res = await fetch(url(p), { headers, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!res.ok) throw new Error(`Vaani GET ${p} → HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return res.json();
  }
  return {
    async health() {
      try {
        const res = await fetch(url("/api/health"), { headers, signal: AbortSignal.timeout(5_000), cache: "no-store" });
        return { ok: res.ok, detail: `HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, detail: (err as Error).message };
      }
    },
    async callHistory() {
      return listFrom(await get("/api/call-history"));
    },
    async callDetails(id) {
      const d = (await get(`/api/call_details/${encodeURIComponent(id)}`)) as Json;
      return ((d?.data as Json) ?? d) as Json;
    },
    async transcript(id) {
      return get(`/api/transcript/${encodeURIComponent(id)}`);
    },
    async stream(id, range) {
      return fetch(url(`/api/stream/${encodeURIComponent(id)}`), {
        headers: { "X-API-Key": apiKey, ...(range ? { Range: range } : {}) },
        cache: "no-store",
      });
    },
  };
}

/** Find the array of calls in whatever envelope the API uses. */
export function listFrom(body: unknown): Json[] {
  if (Array.isArray(body)) return body as Json[];
  const b = body as Json;
  for (const k of ["calls", "data", "results", "items", "call_history", "history"]) {
    const v = b?.[k];
    if (Array.isArray(v)) return v as Json[];
    if (v && typeof v === "object") {
      const inner = listFrom(v);
      if (inner.length) return inner;
    }
  }
  return [];
}

const pick = (o: Json | undefined, keys: string[]): unknown => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
};

export const callIdOf = (o: Json): string | null => {
  const v = pick(o, ["call_id", "callId", "id", "uuid", "room_name", "session_id"]) ?? pick((o?.data ?? o?.call) as Json, ["call_id", "callId", "id"]);
  return v === undefined ? null : String(v);
};

const AGENT_ROLES = ["agent", "assistant", "bot", "ai", "system_agent", "vaani"];
const roleOf = (r: unknown): Speaker => (AGENT_ROLES.includes(String(r ?? "").toLowerCase()) ? "AGENT" : "USER");

/** Accepts [{role, content}], [{speaker, text}], [["AGENT","..."]], or "Agent: ...\nUser: ..." text. */
export function parseTranscript(t: unknown): Turn[] {
  if (!t) return [];
  if (typeof t === "string") {
    return t
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*(agent|assistant|bot|ai|user|caller|customer|human)\s*:\s*(.*)$/i))
      .filter((m): m is RegExpMatchArray => Boolean(m && m[2]))
      .map((m) => [roleOf(m[1]), m[2].trim()] as Turn);
  }
  if (Array.isArray(t)) {
    return t
      .map((x): Turn | null => {
        if (Array.isArray(x)) return [roleOf(x[0]), String(x[1] ?? "")];
        const o = x as Json;
        const text = pick(o, ["content", "text", "message", "transcript", "utterance"]);
        if (text === undefined) return null;
        return [roleOf(pick(o, ["role", "speaker", "from", "sender", "type"])), String(text)];
      })
      .filter((x): x is Turn => Boolean(x && x[1].trim()));
  }
  const o = t as Json;
  return parseTranscript(pick(o, ["transcript", "messages", "conversation", "turns", "data"]));
}

function outcomeOf(status: unknown, transcript: Turn[], durationSec: number | null): CallOutcome {
  const s = String(status ?? "").toLowerCase();
  if (/(no[-_ ]?answer|missed|unanswered|busy|failed|not[-_ ]?connected)/.test(s)) return "missed";
  if (/(disconnect|dropped|abandon|hangup|hung)/.test(s) && transcript.filter(([sp]) => sp === "USER").length < 2) return "disconnected";
  if (!transcript.some(([sp]) => sp === "USER")) return durationSec ? "disconnected" : "missed";
  return "completed";
}

/** Build an IncomingCall from call details (+ optional separate transcript payload). */
export function toIncomingCall(callId: string, details: Json, transcriptPayload?: unknown): IncomingCall {
  const fromPayload = parseTranscript(transcriptPayload);
  const transcript = fromPayload.length ? fromPayload : parseTranscript(details);
  const durRaw = pick(details, ["duration", "duration_sec", "duration_seconds", "call_duration", "durationSeconds"]);
  const durationSec = durRaw === undefined ? null : Math.round(Number(durRaw)) || null;
  const started = pick(details, ["started_at", "start_time", "startTime", "created_at", "createdAt", "timestamp", "call_start_time"]);
  const summary = pick(details, ["summary", "call_summary"]);
  const number = pick(details, ["caller_number", "from_number", "phone_number", "from", "customer_number", "caller", "phone"]);
  return {
    vaaniCallId: callId,
    source: "live",
    callerNumber: number === undefined ? null : String(number),
    startedAt: started === undefined ? null : new Date(typeof started === "number" && started < 1e12 ? started * 1000 : (started as string)).toISOString(),
    durationSec,
    outcome: outcomeOf(pick(details, ["status", "call_status", "end_reason", "disconnection_reason"]), transcript, durationSec),
    transcript,
    summaryVaani: summary === undefined ? null : typeof summary === "string" ? summary : JSON.stringify(summary),
    raw: { details, transcript: transcriptPayload ?? null },
  };
}

/** Does this call belong to our agent? (If the payload has no agent id, assume yes.) */
export function isOurAgent(o: Json, agentId: string | undefined): boolean {
  if (!agentId) return true;
  const a = pick(o, ["agent_id", "agentId", "assistant_id"]);
  return a === undefined || String(a) === agentId;
}
