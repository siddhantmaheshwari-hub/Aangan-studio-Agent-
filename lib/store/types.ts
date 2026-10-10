import type { RuleEvaluation } from "../rules";
import type { CallOutcome, IncomingCall, Status, Turn } from "../types";

export interface CallRow {
  id: number;
  vaani_call_id: string;
  source: string;
  caller_number: string | null;
  started_at: string | null;
  duration_sec: number | null;
  call_outcome: CallOutcome;
  transcript: Turn[];
  enquiry_id: number | null;
  processed_at: string | null;
  attempts: number;
}

export interface EnquiryRow {
  id: number;
  source: string;
  caller_number: string | null;
  status: Status;
  rule_ids: string[];
  flags: string[];
  missing_fields: string[];
  fields: Record<string, unknown>;
  summary: string | null;
  locality_raw: string | null;
  locality_normalised: string | null;
  locality_confidence: number | null;
  extractor: string | null;
  override_status: Status | null;
  override_reason: string | null;
  hubspot_contact_id: string | null;
  hubspot_deal_id: string | null;
  hubspot_deal_url: string | null;
  amount_inr: number | null;
  amount_source: string | null;
  handoff_at: string | null;
  created_at: string;
}

export type EnquiryWrite = Partial<Omit<EnquiryRow, "id" | "created_at">>;

export interface NotificationRow {
  enquiry_id: number | null;
  kind: "handoff" | "escalation" | "system_alert" | "digest";
  channel: "resend" | "telegram";
  attempt: number;
  ok: boolean;
  provider_id: string | null;
  recipient: string | null;
  error: string | null;
  created_at?: string;
}

export interface Store {
  /** Insert if new (by vaani_call_id); otherwise return the existing row. Never overwrites. */
  saveCall(call: IncomingCall): Promise<{ call: CallRow; created: boolean }>;
  getCall(id: number): Promise<CallRow | null>;
  getCallByVaaniId(vaaniCallId: string): Promise<CallRow | null>;
  ping(): Promise<void>;
  /** Calls from this number with started_at in [since, until]. */
  callsFromCaller(number: string, since: string, until: string): Promise<CallRow[]>;
  linkCall(callId: number, enquiryId: number): Promise<void>;
  markProcessed(callId: number): Promise<void>;
  /** Take a short lease on an unprocessed call. Returns the attempt number, or null if done or busy. */
  claimCall(callId: number): Promise<number | null>;
  /** Drop the lease after a failure so the next sync can retry. */
  releaseCall(callId: number): Promise<void>;
  /** Allow a call that hit the retry limit to be tried again (founder action). */
  resetAttempts(callId: number): Promise<void>;

  getEnquiry(id: number): Promise<EnquiryRow | null>;
  createEnquiry(data: EnquiryWrite & { status: Status }): Promise<EnquiryRow>;
  updateEnquiry(id: number, patch: EnquiryWrite): Promise<EnquiryRow>;
  replaceRuleEvaluations(enquiryId: number, evals: RuleEvaluation[]): Promise<void>;

  addNotification(n: NotificationRow): Promise<void>;
  notificationsFor(enquiryId: number): Promise<NotificationRow[]>;
  addCostEvent(e: { call_id: number; kind: string; model: string; input_tokens: number; output_tokens: number; cost_inr: number | null }): Promise<void>;
  addPipelineError(e: { call_id: number | null; step: string; message: string }): Promise<void>;
  addAudit(a: { enquiry_id?: number | null; call_id?: number | null; actor: string; action: string; detail?: unknown }): Promise<void>;

  getState(key: string): Promise<string | null>;
  setState(key: string, value: string): Promise<void>;
}
