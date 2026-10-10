// Fetches finished calls from Vaani and runs them through the pipeline.
// Used by the webhook (one call) and by /api/sync polling (a few calls per run).
import { type PipelineDeps, type ProcessResult, processCall } from "./pipeline";
import { callIdOf, isOurAgent, toIncomingCall, type VaaniClient } from "./vaani";

/** A call with no transcript yet, younger than this, is left for the next sync (Vaani may still be writing it). */
const NOT_READY_MS = 10 * 60_000;

export type VaaniProcessResult = ProcessResult | { notReady: true; vaaniCallId: string };

export async function processVaaniCall(deps: PipelineDeps, vaani: VaaniClient, vaaniCallId: string): Promise<VaaniProcessResult> {
  const details = await vaani.callDetails(vaaniCallId);
  let transcript: unknown = null;
  try {
    transcript = await vaani.transcript(vaaniCallId);
  } catch {
    // Some calls carry the transcript inside call_details; fall back to that.
  }
  const incoming = toIncomingCall(vaaniCallId, details, transcript);
  const age = incoming.startedAt ? Date.now() - Date.parse(incoming.startedAt) : 0;
  if (incoming.transcript.length === 0 && age < NOT_READY_MS) return { notReady: true, vaaniCallId };
  return processCall(deps, incoming);
}

export interface SyncSummary {
  seen: number;
  processed: { vaaniCallId: string; status: string | null; error?: string }[];
  remaining: number;
}

export async function syncFromVaani(deps: PipelineDeps, vaani: VaaniClient, agentId: string | undefined, budgetMs = 40_000): Promise<SyncSummary> {
  const start = Date.now();
  const history = (await vaani.callHistory()).filter((c) => isOurAgent(c, agentId));
  const ids = history.map(callIdOf).filter((x): x is string => Boolean(x));

  const todo: string[] = [];
  for (const id of ids) {
    const existing = await deps.store.getCallByVaaniId(id);
    if (!existing?.processed_at) todo.push(id);
  }

  const processed: SyncSummary["processed"] = [];
  for (const id of todo) {
    if (Date.now() - start > budgetMs) break; // stay well inside the function time limit; next run continues
    try {
      const r = await processVaaniCall(deps, vaani, id);
      processed.push("notReady" in r ? { vaaniCallId: id, status: "not_ready" } : { vaaniCallId: id, status: r.status, error: r.error });
    } catch (err) {
      await deps.store.addPipelineError({ call_id: null, step: "sync", message: `${id}: ${(err as Error).message}` });
      processed.push({ vaaniCallId: id, status: null, error: (err as Error).message });
    }
  }
  return { seen: ids.length, processed, remaining: todo.length - processed.length };
}
