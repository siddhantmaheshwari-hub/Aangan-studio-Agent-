// Shared types. No secrets, no server-only imports — safe anywhere.

export type Speaker = "AGENT" | "USER";
export type Turn = [Speaker, string];

export type CallOutcome = "completed" | "missed" | "disconnected" | "unknown";

/** A call as we receive it, from Vaani or from a fixture, before anything is stored. */
export interface IncomingCall {
  vaaniCallId: string;
  source: "live" | "replay";
  callerNumber: string | null;
  startedAt: string | null; // ISO
  durationSec: number | null;
  outcome: CallOutcome;
  transcript: Turn[];
  summaryVaani?: string | null;
  raw?: unknown;
}

export const STATUSES = [
  "escalation",
  "missed",
  "not_qualified",
  "needs_review",
  "incomplete",
  "qualified",
] as const;
export type Status = (typeof STATUSES)[number];

/** Highest first. */
export const STATUS_PRECEDENCE: Record<Status, number> = {
  escalation: 6,
  missed: 5,
  not_qualified: 4,
  needs_review: 3,
  incomplete: 2,
  qualified: 1,
};

export const FLAGS = [
  "price_asked",
  "price_figure_spoken",
  "budget_volunteered",
  "referral",
  "tenant",
  "caller_not_decision_maker",
  "prior_contact_frustrated",
  "timeline_reoffer",
  "booked",
  "priority",
] as const;
export type Flag = (typeof FLAGS)[number];
