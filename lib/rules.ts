// The rules engine. Gemini only extracts facts; THIS file decides the status.
// All rules are PROXY until Nikhil's qualified.md / services.md arrive.
import { type Extraction, v } from "./extract/schema";
import type { LocalityResult } from "./locality";
import type { PriceHit } from "./priceScanner";
import { type Flag, type Status, STATUS_PRECEDENCE } from "./types";

export interface RuleInput {
  extraction: Extraction;
  locality: LocalityResult;
  priceHits: PriceHit[];
  /** True when none of the enquiry's calls completed (missed / dropped only). */
  noCompletedCall?: boolean;
  /** Approved minimum budget in INR. Not configured today → any volunteered budget goes to review. */
  budgetFloorInr?: number | null;
}

export interface RuleEvaluation {
  ruleId: string;
  description: string;
  fired: boolean;
  result: Status | null;
  detail: string;
}

export interface RuleOutcome {
  status: Status;
  ruleIds: string[];
  flags: Flag[];
  missingFields: string[];
  evaluations: RuleEvaluation[];
}

export const RULES: Record<string, string> = {
  "R-MISSED-01": "No completed call (missed or disconnected)",
  "R-ESC-01": "Existing project complaint, or asks for Nikhil / a senior person",
  "R-AREA-01": "Location clearly in another city",
  "R-AREA-02": "Locality not on the in-area list (borderline, unknown, or low-confidence match)",
  "R-SCOPE-01": "Advice/consultation only, no execution",
  "R-TYPE-01": "Restaurant, hospitality or gym",
  "R-TYPE-02": "Other non-residential, non-office type",
  "R-SIZE-01": "Commercial under 500 sq ft",
  "R-SIZE-02": "Commercial over 3,000 sq ft",
  "R-TIME-01": "Wants completion in under 8 weeks and did not accept a later start",
  "R-BUDGET-01": "Budget volunteered and no approved floor configured (or below it)",
  "R-PRICE-01": "Agent spoke a price figure",
  "R-COMPLETE-01": "Missing location or project type",
};

const COMMERCIAL_MIN_SQFT = 500;
const COMMERCIAL_MAX_SQFT = 3000;
const MIN_WEEKS = 8;
const PRIORITY_HOME_SQFT = 3000;

export function evaluate(input: RuleInput): RuleOutcome {
  const e = input.extraction;
  const loc = input.locality;
  const evals: RuleEvaluation[] = [];
  const add = (ruleId: string, fired: boolean, result: Status, detail: string) =>
    evals.push({ ruleId, description: RULES[ruleId], fired, result: fired ? result : null, detail });

  const type = v(e, "property_type");
  const sqft = v(e, "size_sqft");
  const weeks = v(e, "completion_within_weeks");
  const laterAccepted = v(e, "later_start_accepted");
  const otherCity = v(e, "other_city");
  const hasLocation = Boolean(v(e, "locality") || otherCity);

  add("R-MISSED-01", Boolean(input.noCompletedCall), "missed", input.noCompletedCall ? "No completed call" : "A call completed");

  const complaint = v(e, "existing_client_complaint") === true;
  const senior = v(e, "asks_for_senior") === true;
  add("R-ESC-01", complaint || senior, "escalation",
    [complaint && "existing-client complaint", senior && "asked for Nikhil/senior"].filter(Boolean).join("; ") || "No complaint, no request for a senior person");

  const areaOther = Boolean(otherCity) || loc.kind === "other_city";
  add("R-AREA-01", areaOther, "not_qualified",
    areaOther ? `Outside Pune/PCMC: ${otherCity ?? loc.normalised}` : "Not another city");

  const areaReview = !areaOther && Boolean(v(e, "locality")) && loc.kind !== "in_area";
  add("R-AREA-02", areaReview, "needs_review",
    areaReview
      ? `"${loc.raw}" → ${loc.normalised ?? "no match"} (${loc.kind}, confidence ${loc.confidence})`
      : loc.kind === "in_area" ? `"${loc.raw}" → ${loc.normalised} (in area)` : "No locality given");

  const adviceOnly = v(e, "scope") === "advice_only";
  add("R-SCOPE-01", adviceOnly, "not_qualified", adviceOnly ? "Wants advice only, no execution" : "Scope is not advice-only");

  const hosp = type === "hospitality" || type === "fitness";
  add("R-TYPE-01", hosp, "not_qualified", hosp ? `Property type: ${type}` : `Property type: ${type ?? "missing"}`);

  const otherType = type === "retail" || type === "other";
  add("R-TYPE-02", otherType, "needs_review", otherType ? `Property type: ${type}` : "Home, office or not given");

  const office = type === "office";
  const small = office && sqft !== null && sqft < COMMERCIAL_MIN_SQFT;
  add("R-SIZE-01", small, "not_qualified", office ? `Office, ${sqft ?? "size unknown"} sq ft` : "Not commercial");
  const big = office && sqft !== null && sqft > COMMERCIAL_MAX_SQFT;
  add("R-SIZE-02", big, "needs_review", office ? `Office, ${sqft ?? "size unknown"} sq ft` : "Not commercial");

  const rushed = weeks !== null && weeks < MIN_WEEKS && laterAccepted !== true;
  add("R-TIME-01", rushed, "not_qualified",
    weeks === null ? "No finish date given" : `Finish wanted in ~${weeks} weeks; later start accepted: ${laterAccepted ?? "not offered"}`);

  const budgetGiven = v(e, "budget_volunteered") === true;
  const budgetTop = v(e, "budget_max_inr") ?? v(e, "budget_min_inr");
  const floor = input.budgetFloorInr ?? null;
  const budgetReview = budgetGiven && (floor === null || budgetTop === null || budgetTop < floor);
  add("R-BUDGET-01", budgetReview, "needs_review",
    !budgetGiven ? "No budget volunteered" : floor === null ? "Budget volunteered; no approved floor configured" : `Budget ${budgetTop} vs floor ${floor}`);

  const priceSpoken = input.priceHits.length > 0;
  add("R-PRICE-01", priceSpoken, "needs_review",
    priceSpoken ? `Agent said: "${input.priceHits.map((h) => h.match).join('", "')}"` : "No price figure spoken by the agent");

  const missingCore = [!hasLocation && "location", !type && "project type"].filter(Boolean) as string[];
  add("R-COMPLETE-01", missingCore.length > 0, "incomplete",
    missingCore.length ? `Missing: ${missingCore.join(", ")}` : "Location and project type present");

  // Status = highest-precedence result among fired rules; qualified if none fired.
  const fired = evals.filter((r) => r.fired && r.result);
  let status: Status = "qualified";
  for (const r of fired) if (STATUS_PRECEDENCE[r.result!] > STATUS_PRECEDENCE[status]) status = r.result!;

  // Flags (informational; only price_figure_spoken changes status, via R-PRICE-01).
  const flags = new Set<Flag>();
  if (v(e, "price_asked")) flags.add("price_asked");
  if (priceSpoken) flags.add("price_figure_spoken");
  if (budgetGiven) flags.add("budget_volunteered");
  if (v(e, "referred_by")) flags.add("referral");
  if (v(e, "tenant")) flags.add("tenant");
  if (v(e, "decision_maker") === "someone_else") flags.add("caller_not_decision_maker");
  if (v(e, "prior_contact_frustrated")) flags.add("prior_contact_frustrated");
  if (v(e, "later_start_offered") || (weeks !== null && weeks < MIN_WEEKS)) flags.add("timeline_reoffer");
  if (v(e, "booked")) flags.add("booked");
  if (type === "home" && sqft !== null && sqft >= PRIORITY_HOME_SQFT) flags.add("priority");

  // Shown as "missing" on the dashboard; they don't block qualification.
  const missingFields = [
    !hasLocation && "location",
    !type && "project type",
    !v(e, "scope") && "scope",
    !v(e, "timeline") && "timeline",
    !v(e, "caller_name") && "name",
  ].filter(Boolean) as string[];

  return { status, ruleIds: fired.map((r) => r.ruleId), flags: [...flags], missingFields, evaluations: evals };
}
