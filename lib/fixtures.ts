// Loads fixture calls (case transcripts + synthetic) as IncomingCall objects.
import cases from "../fixtures/phone_transcripts.json";
import synthetic from "../fixtures/synthetic.json";
import type { CallOutcome, IncomingCall, Turn } from "./types";

interface FixtureCall {
  fixture_id: string;
  call_id: string;
  caller_number: string;
  started_at: string;
  duration_sec: number;
  call_status: string;
  transcript: string[][];
}

export interface Fixture {
  fixtureId: string;
  call: IncomingCall;
}

function toFixture(f: FixtureCall): Fixture {
  return {
    fixtureId: f.fixture_id,
    call: {
      vaaniCallId: f.call_id,
      source: "replay",
      callerNumber: f.caller_number,
      startedAt: f.started_at,
      durationSec: f.duration_sec,
      outcome: (["completed", "missed", "disconnected"].includes(f.call_status) ? f.call_status : "unknown") as CallOutcome,
      transcript: f.transcript as Turn[],
    },
  };
}

export const FIXTURES: Fixture[] = [
  ...(cases.calls as FixtureCall[]).map(toFixture),
  ...(synthetic.calls as FixtureCall[]).map(toFixture),
];

/** Expected result per fixture. Source: qualified.md + services.md (10 Oct) — they replaced the PROXY rules
 *  in CLAUDE.md. Changed vs CLAUDE.md: T10 (budget clearly below → not forwarded, qualified.md §4),
 *  T18 (services.md sets no minimum office size → a person decides), S02 (Hinjewadi is in the service area). */
export const EXPECTED: Record<string, { status: string; rules?: string[]; flags?: string[]; noFlags?: string[] }> = {
  T01: { status: "qualified", flags: ["referral"] },
  T02: { status: "qualified", flags: ["price_asked"] },
  T03: { status: "not_qualified", rules: ["R-AREA-01"] },
  T04: { status: "not_qualified", rules: ["R-SCOPE-01"] },
  T05: { status: "qualified", flags: ["referral"] },
  T06: { status: "qualified" },
  T07: { status: "not_qualified", rules: ["R-TIME-01"], flags: ["timeline_reoffer"] },
  T08: { status: "missed" },
  T09: { status: "escalation", rules: ["R-ESC-01"] },
  T10: { status: "not_qualified", rules: ["R-BUDGET-01"], flags: ["budget_volunteered"] },
  T11: { status: "qualified", flags: ["tenant"] },
  T12: { status: "qualified", flags: ["priority"] },
  T13: { status: "qualified", flags: ["price_asked"] },
  T14: { status: "qualified", flags: ["caller_not_decision_maker"] },
  T15: { status: "qualified" },
  T16: { status: "qualified", flags: ["prior_contact_frustrated"] },
  T17a: { status: "missed" },
  T17b: { status: "qualified" },
  T18: { status: "needs_review", rules: ["R-SIZE-01"] },
  T19: { status: "not_qualified", rules: ["R-TYPE-01"] },
  T20: { status: "qualified" },
  S01: { status: "needs_review", rules: ["R-PRICE-01"], flags: ["price_figure_spoken"] },
  S02: { status: "qualified" },
  S03: { status: "not_qualified", rules: ["R-AREA-01"] },
  S04: { status: "qualified", flags: ["referral", "budget_volunteered"] },
  S05: { status: "not_qualified", rules: ["R-TIME-01"], flags: ["timeline_reoffer"] },
  S06: { status: "needs_review", rules: ["R-TIME-02"], flags: ["budget_volunteered"] },
};

export function checkExpected(fixtureId: string, r: { status: string | null; ruleIds: string[]; flags: string[] }): string[] {
  const exp = EXPECTED[fixtureId];
  if (!exp) return [`no expectation for ${fixtureId}`];
  const problems: string[] = [];
  if (r.status !== exp.status) problems.push(`status ${r.status} ≠ ${exp.status}`);
  for (const id of exp.rules ?? []) if (!r.ruleIds.includes(id)) problems.push(`missing rule ${id}`);
  for (const fl of exp.flags ?? []) if (!r.flags.includes(fl)) problems.push(`missing flag ${fl}`);
  return problems;
}
