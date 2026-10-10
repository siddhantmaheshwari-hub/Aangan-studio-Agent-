// Fetches finished calls from Vaani and runs them through the pipeline.
// Used by the webhook (one call) and by /api/sync polling (a few calls per run).
import { MAX_ATTEMPTS, type PipelineDeps, type ProcessResult, processCall } from "./pipeline";
import { callIdOf, isNotReady, isOurAgent, toIncomingCall, type VaaniClient } from "./vaani";

type Json = Record<string, unknown>;

export type VaaniProcessResult = ProcessResult | { notReady: true; vaaniCallId: string };

/**
 * Gathers everything Vaani knows about one call and processes it.
 * `history` (from a sync page) and `webhook` (the call_postprocessing payload) save lookups when available.
 */
export async function processVaaniCall(
  deps: PipelineDeps,
  vaani: VaaniClient,
  vaaniCallId: string,
  known: { history?: Json | null; webhook?: Json | null } = {},
): Promise<VaaniProcessResult> {
  // Call history is the only source of caller number and start time; look it up if we weren't given it.
  const history = known.history ?? (await vaani.findInHistory(vaaniCallId).catch(() => null));
  if (history && isNotReady({ history })) return { notReady: true, vaaniCallId };

  const [details, transcript] = await Promise.all([
    vaani.callDetails(vaaniCallId).catch(() => null),
    vaani.transcript(vaaniCallId).catch(() => null),
  ]);
  const src = { history, details, transcript, webhook: known.webhook ?? null };
  if (isNotReady(src)) return { notReady: true, vaaniCallId };
  return processCall(deps, toIncomingCall(vaaniCallId, src));
}

export interface SyncSummary {
  seen: number;
  processed: { vaaniCallId: string; status: string | null; error?: string }[];
  remaining: number;
}

export async function syncFromVaani(deps: PipelineDeps, vaani: VaaniClient, agentId: string | undefined, budgetMs = 40_000): Promise<SyncSummary> {
  const start = Date.now();
  const history = (await vaani.callHistory(1, 100)).filter((c) => isOurAgent(c, agentId));

  const todo: Json[] = [];
  for (const row of history) {
    const id = callIdOf(row);
    if (!id) continue;
    const existing = await deps.store.getCallByVaaniId(id);
    if (!existing || (!existing.processed_at && existing.attempts < MAX_ATTEMPTS)) todo.push(row);
  }

  const processed: SyncSummary["processed"] = [];
  for (const row of todo) {
    if (Date.now() - start > budgetMs) break; // stay well inside the function time limit; next run continues
    const id = callIdOf(row)!;
    try {
      const r = await processVaaniCall(deps, vaani, id, { history: row });
      processed.push("notReady" in r ? { vaaniCallId: id, status: "not_ready" } : { vaaniCallId: id, status: r.status, error: r.error });
    } catch (err) {
      await deps.store.addPipelineError({ call_id: null, step: "sync", message: `${id}: ${(err as Error).message}` });
      processed.push({ vaaniCallId: id, status: null, error: (err as Error).message });
    }
  }
  return { seen: history.length, processed, remaining: todo.length - processed.length };
}
