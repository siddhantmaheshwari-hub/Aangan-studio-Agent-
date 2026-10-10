// In-memory Store for tests and the fixture replay table. Same behaviour as the Neon store.
import type { RuleEvaluation } from "../rules";
import type { CallRow, EnquiryRow, NotificationRow, Store } from "./types";

export class MemoryStore implements Store {
  calls: CallRow[] = [];
  enquiries: EnquiryRow[] = [];
  ruleEvals: { enquiry_id: number; evals: RuleEvaluation[] }[] = [];
  notifications: NotificationRow[] = [];
  costEvents: { call_id: number; kind: string; model: string; input_tokens: number; output_tokens: number; cost_inr: number | null }[] = [];
  errors: { call_id: number | null; step: string; message: string }[] = [];
  audit: unknown[] = [];
  state = new Map<string, string>();

  async saveCall(c: Parameters<Store["saveCall"]>[0]) {
    const existing = this.calls.find((r) => r.vaani_call_id === c.vaaniCallId);
    if (existing) return { call: existing, created: false };
    const row: CallRow = {
      id: this.calls.length + 1,
      vaani_call_id: c.vaaniCallId,
      source: c.source,
      caller_number: c.callerNumber,
      started_at: c.startedAt ? new Date(c.startedAt).toISOString() : null,
      duration_sec: c.durationSec,
      call_outcome: c.outcome,
      transcript: c.transcript,
      enquiry_id: null,
      processed_at: null,
    };
    this.calls.push(row);
    return { call: row, created: true };
  }
  async getCall(id: number) {
    return this.calls.find((c) => c.id === id) ?? null;
  }
  async getCallByVaaniId(id: string) {
    return this.calls.find((c) => c.vaani_call_id === id) ?? null;
  }
  async ping() {}
  async callsFromCaller(number: string, since: string, until: string) {
    const s = Date.parse(since), u = Date.parse(until);
    return this.calls
      .filter((c) => c.caller_number === number && c.started_at && Date.parse(c.started_at) >= s && Date.parse(c.started_at) <= u)
      .sort((a, b) => Date.parse(a.started_at!) - Date.parse(b.started_at!));
  }
  async linkCall(callId: number, enquiryId: number) {
    const c = this.calls.find((r) => r.id === callId);
    if (c) c.enquiry_id = enquiryId;
  }
  async markProcessed(callId: number) {
    const c = this.calls.find((r) => r.id === callId);
    if (c) c.processed_at = new Date().toISOString();
  }
  async getEnquiry(id: number) {
    return this.enquiries.find((e) => e.id === id) ?? null;
  }
  async createEnquiry(data: Parameters<Store["createEnquiry"]>[0]) {
    const row: EnquiryRow = {
      id: this.enquiries.length + 1, source: "live", caller_number: null, rule_ids: [], flags: [], missing_fields: [],
      fields: {}, summary: null, locality_raw: null, locality_normalised: null, locality_confidence: null, extractor: null,
      override_status: null, override_reason: null, hubspot_contact_id: null, hubspot_deal_id: null, hubspot_deal_url: null,
      amount_inr: null, amount_source: null, handoff_at: null, created_at: new Date().toISOString(), ...data,
    };
    this.enquiries.push(row);
    return row;
  }
  async updateEnquiry(id: number, patch: Parameters<Store["updateEnquiry"]>[1]) {
    const e = this.enquiries.find((r) => r.id === id);
    if (!e) throw new Error(`enquiry ${id} not found`);
    Object.assign(e, patch);
    return e;
  }
  async replaceRuleEvaluations(enquiryId: number, evals: RuleEvaluation[]) {
    this.ruleEvals = this.ruleEvals.filter((r) => r.enquiry_id !== enquiryId);
    this.ruleEvals.push({ enquiry_id: enquiryId, evals });
  }
  async addNotification(n: NotificationRow) {
    this.notifications.push({ ...n, created_at: new Date().toISOString() });
  }
  async notificationsFor(enquiryId: number) {
    return this.notifications.filter((n) => n.enquiry_id === enquiryId);
  }
  async addCostEvent(e: MemoryStore["costEvents"][number]) {
    this.costEvents.push(e);
  }
  async addPipelineError(e: MemoryStore["errors"][number]) {
    this.errors.push(e);
  }
  async addAudit(a: unknown) {
    this.audit.push(a);
  }
  async getState(key: string) {
    return this.state.get(key) ?? null;
  }
  async setState(key: string, value: string) {
    this.state.set(key, value);
  }
}
