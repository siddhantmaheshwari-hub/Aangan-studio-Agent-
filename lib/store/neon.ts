// Neon (Postgres) Store. Server-side only.
import { neon } from "@neondatabase/serverless";
import type { RuleEvaluation } from "../rules";
import type { CallRow, EnquiryRow, EnquiryWrite, NotificationRow, Store } from "./types";

type Sql = ReturnType<typeof neon>;

const ENQUIRY_COLUMNS = [
  "source", "caller_number", "status", "rule_ids", "flags", "missing_fields", "fields", "summary", "locality_raw",
  "locality_normalised", "locality_confidence", "extractor", "override_status", "override_reason", "hubspot_contact_id",
  "hubspot_deal_id", "hubspot_deal_url", "amount_inr", "amount_source", "handoff_at",
] as const;

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : (d as string | null));

function toCall(r: Record<string, unknown>): CallRow {
  return {
    ...(r as unknown as CallRow),
    id: Number(r.id),
    enquiry_id: r.enquiry_id === null ? null : Number(r.enquiry_id),
    started_at: iso(r.started_at),
    processed_at: iso(r.processed_at),
  };
}
function toEnquiry(r: Record<string, unknown>): EnquiryRow {
  return {
    ...(r as unknown as EnquiryRow),
    id: Number(r.id),
    amount_inr: r.amount_inr === null ? null : Number(r.amount_inr),
    handoff_at: iso(r.handoff_at),
    created_at: iso(r.created_at)!,
  };
}

export class NeonStore implements Store {
  constructor(private sql: Sql) {}

  private async q(text: string, params: unknown[] = []) {
    return (await this.sql.query(text, params)) as Record<string, unknown>[];
  }

  async saveCall(c: Parameters<Store["saveCall"]>[0]) {
    const inserted = await this.q(
      `insert into calls (vaani_call_id, source, caller_number, started_at, duration_sec, call_outcome, transcript, summary_vaani, raw)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (vaani_call_id) do nothing returning *`,
      [c.vaaniCallId, c.source, c.callerNumber, c.startedAt, c.durationSec, c.outcome, JSON.stringify(c.transcript),
        c.summaryVaani ?? null, c.raw === undefined ? null : JSON.stringify(c.raw)],
    );
    if (inserted[0]) return { call: toCall(inserted[0]), created: true };
    const existing = await this.q(`select * from calls where vaani_call_id = $1`, [c.vaaniCallId]);
    return { call: toCall(existing[0]), created: false };
  }
  async getCall(id: number) {
    const r = await this.q(`select * from calls where id = $1`, [id]);
    return r[0] ? toCall(r[0]) : null;
  }
  async getCallByVaaniId(id: string) {
    const r = await this.q(`select * from calls where vaani_call_id = $1`, [id]);
    return r[0] ? toCall(r[0]) : null;
  }
  async ping() {
    await this.q(`select 1`);
  }
  async callsFromCaller(number: string, since: string, until: string) {
    const r = await this.q(
      `select * from calls where caller_number = $1 and started_at between $2 and $3 order by started_at`,
      [number, since, until],
    );
    return r.map(toCall);
  }
  async linkCall(callId: number, enquiryId: number) {
    await this.q(`update calls set enquiry_id = $2 where id = $1`, [callId, enquiryId]);
  }
  async markProcessed(callId: number) {
    await this.q(`update calls set processed_at = now() where id = $1`, [callId]);
  }

  async getEnquiry(id: number) {
    const r = await this.q(`select * from enquiries where id = $1`, [id]);
    return r[0] ? toEnquiry(r[0]) : null;
  }
  private cols(data: EnquiryWrite) {
    const keys = ENQUIRY_COLUMNS.filter((k) => k in data);
    const vals = keys.map((k) => (k === "fields" ? JSON.stringify(data[k]) : data[k]));
    return { keys, vals };
  }
  async createEnquiry(data: Parameters<Store["createEnquiry"]>[0]) {
    const { keys, vals } = this.cols(data);
    const r = await this.q(
      `insert into enquiries (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
      vals,
    );
    return toEnquiry(r[0]);
  }
  async updateEnquiry(id: number, patch: EnquiryWrite) {
    const { keys, vals } = this.cols(patch);
    const set = [...keys.map((k, i) => `${k} = $${i + 2}`), "updated_at = now()"].join(", ");
    const r = await this.q(`update enquiries set ${set} where id = $1 returning *`, [id, ...vals]);
    if (!r[0]) throw new Error(`enquiry ${id} not found`);
    return toEnquiry(r[0]);
  }
  async replaceRuleEvaluations(enquiryId: number, evals: RuleEvaluation[]) {
    await this.sql.transaction([
      this.sql.query(`delete from rule_evaluations where enquiry_id = $1`, [enquiryId]),
      ...evals.map((e) =>
        this.sql.query(
          `insert into rule_evaluations (enquiry_id, rule_id, fired, result, detail) values ($1,$2,$3,$4,$5)`,
          [enquiryId, e.ruleId, e.fired, e.result, e.detail],
        ),
      ),
    ]);
  }

  async addNotification(n: NotificationRow) {
    await this.q(
      `insert into notifications (enquiry_id, kind, channel, attempt, ok, provider_id, recipient, error) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [n.enquiry_id, n.kind, n.channel, n.attempt, n.ok, n.provider_id, n.recipient, n.error],
    );
  }
  async notificationsFor(enquiryId: number) {
    const r = await this.q(`select * from notifications where enquiry_id = $1 order by created_at, id`, [enquiryId]);
    return r.map((x) => ({ ...(x as unknown as NotificationRow), created_at: iso(x.created_at) ?? undefined }));
  }
  async addCostEvent(e: Parameters<Store["addCostEvent"]>[0]) {
    await this.q(
      `insert into cost_events (call_id, kind, model, input_tokens, output_tokens, cost_inr) values ($1,$2,$3,$4,$5,$6)`,
      [e.call_id, e.kind, e.model, e.input_tokens, e.output_tokens, e.cost_inr],
    );
  }
  async addPipelineError(e: Parameters<Store["addPipelineError"]>[0]) {
    await this.q(`insert into pipeline_errors (call_id, step, message) values ($1,$2,$3)`, [e.call_id, e.step, e.message]);
  }
  async addAudit(a: Parameters<Store["addAudit"]>[0]) {
    await this.q(`insert into audit_log (enquiry_id, call_id, actor, action, detail) values ($1,$2,$3,$4,$5)`, [
      a.enquiry_id ?? null, a.call_id ?? null, a.actor, a.action, a.detail === undefined ? null : JSON.stringify(a.detail),
    ]);
  }
  async getState(key: string) {
    const r = await this.q(`select value from sync_state where key = $1`, [key]);
    return (r[0]?.value as string | undefined) ?? null;
  }
  async setState(key: string, value: string) {
    await this.q(
      `insert into sync_state (key, value, updated_at) values ($1,$2,now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, value],
    );
  }
}

export function neonStore(databaseUrl: string): NeonStore {
  return new NeonStore(neon(databaseUrl));
}
