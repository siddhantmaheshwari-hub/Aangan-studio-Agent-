// The rules engine. Gemini only extracts facts; THIS file decides the status.
// Source of truth: qualified.md (Nikhil's five criteria) and services.md (scope, area, timelines).
// Complaint handling and "never auto-decline a borderline case" come from CLAUDE.md.
import { checkBudget } from "./budgetCheck";
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
  "R-AREA-01": "Outside Pune city / PCMC (e.g. Talegaon, Lonavala, Nashik, Mumbai) — services.md",
  "R-AREA-02": "Locality not recognised as Pune city or PCMC — a person confirms",
  "R-SCOPE-01": "Not a design-and-execution project: advice/decor only, furniture sourcing only, Vastu only, or structural work — qualified.md §1, services.md",
  "R-SCOPE-02": "Wants structural changes (walls moved) as part of the project — services.md",
  "R-TYPE-01": "Restaurant, hotel, retail store or gym — services.md",
  "R-TYPE-02": "Other non-residential, non-office type — a person confirms",
  "R-SIZE-01": "Commercial space under 500 sq ft — services.md sets no minimum, so a person decides",
  "R-SIZE-02": "Commercial space over ~3,000 sq ft — services.md",
  "R-TIME-01": "Must be finished in under 6 weeks and did not accept a later start — services.md",
  "R-TIME-02": "Site not available for execution within 10 weeks — qualified.md §3",
  "R-BUDGET-01": "Volunteered budget clearly below any project of this scope — qualified.md §4",
  "R-BUDGET-02": "Volunteered budget below the usual minimum for this scope — a person decides",
  "R-DM-01": "Caller is not the decision-maker and the decider is not involved — qualified.md §5",
  "R-PRICE-01": "Agent spoke a price figure",
  "R-COMPLETE-01": "Missing location or project type",
};

const COMMERCIAL_MIN_SQFT = 500;
const COMMERCIAL_MAX_SQFT = 3000;
const MIN_LEAD_WEEKS = 6; // services.md: cannot begin a project that must be ready in under 6 weeks
const SITE_AVAILABLE_WEEKS = 10; // qualified.md §3: execution within 8–10 weeks of the consultation
const PRIORITY_HOME_SQFT = 3000;

const SCOPE_TEXT: Record<string, string> = {
  advice_only: "wants advice/decor only",
  furniture_only: "wants furniture sourcing only",
  vastu_only: "wants Vastu advice only",
  structural_only: "wants structural/architectural work",
};

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
  const scope = v(e, "scope");

  add("R-MISSED-01", Boolean(input.noCompletedCall), "missed", input.noCompletedCall ? "No completed call" : "A call completed");

  const complaint = v(e, "existing_client_complaint") === true;
  const senior = v(e, "asks_for_senior") === true;
  add("R-ESC-01", complaint || senior, "escalation",
    [complaint && "existing-client complaint", senior && "asked for Nikhil/senior"].filter(Boolean).join("; ") || "No complaint, no request for a senior person");

  // Criterion 2 — service area
  const outside = Boolean(otherCity) || loc.kind === "other_city";
  add("R-AREA-01", outside, "not_qualified", outside ? `Outside the service area: ${loc.normalised ?? otherCity}` : "Not outside the service area");
  const areaReview = !outside && Boolean(v(e, "locality")) && loc.kind !== "in_area";
  add("R-AREA-02", areaReview, "needs_review",
    areaReview
      ? `"${loc.raw}" → ${loc.normalised ?? "no match"} (match ${Math.round(loc.confidence * 100)}%)`
      : loc.kind === "in_area" ? `"${loc.raw}" → ${loc.normalised} (in area)` : "No locality given");

  // Criterion 1 — real project; services.md exclusions
  const excluded = scope !== null && scope in SCOPE_TEXT;
  add("R-SCOPE-01", excluded, "not_qualified", excluded ? `Caller ${SCOPE_TEXT[scope!]}` : "Design and execution (or not stated)");
  const structural = !excluded && v(e, "structural_changes") === true;
  add("R-SCOPE-02", structural, "needs_review", structural ? "Caller wants structural changes; Aangan does not move walls" : "No structural changes requested");

  const hosp = type === "hospitality" || type === "fitness" || type === "retail";
  add("R-TYPE-01", hosp, "not_qualified", `Property type: ${type ?? "missing"}`);
  const otherType = type === "other";
  add("R-TYPE-02", otherType, "needs_review", otherType ? "Property type: other" : "Home, office or not given");

  const office = type === "office";
  add("R-SIZE-01", office && sqft !== null && sqft < COMMERCIAL_MIN_SQFT, "needs_review", office ? `Commercial, ${sqft ?? "size unknown"} sq ft` : "Not commercial");
  add("R-SIZE-02", office && sqft !== null && sqft > COMMERCIAL_MAX_SQFT, "needs_review", office ? `Commercial, ${sqft ?? "size unknown"} sq ft` : "Not commercial");

  // Criterion 3 — realistic timeline
  const rushed = weeks !== null && weeks < MIN_LEAD_WEEKS && laterAccepted !== true;
  add("R-TIME-01", rushed, "not_qualified",
    weeks === null ? "No finish date given" : `Finish wanted in ~${weeks} weeks; later start accepted: ${laterAccepted ?? "not offered"}`);
  const siteWeeks = v(e, "site_available_in_weeks");
  const siteLate = siteWeeks !== null && siteWeeks > SITE_AVAILABLE_WEEKS;
  add("R-TIME-02", siteLate, "needs_review", siteWeeks === null ? "Site availability not discussed" : `Site available in ~${siteWeeks} weeks`);

  // Criterion 4 — budget band (only when volunteered; never probed)
  const budgetGiven = v(e, "budget_volunteered") === true;
  const budget = budgetGiven
    ? checkBudget({ budgetMaxInr: v(e, "budget_max_inr"), budgetMinInr: v(e, "budget_min_inr"), propertyType: type, sizeSqft: sqft, roomsCount: v(e, "rooms_count") })
    : null;
  add("R-BUDGET-01", budget?.verdict === "clearly_below", "not_qualified", budget ? budget.detail : "No budget volunteered (treated as qualified)");
  add("R-BUDGET-02", budget?.verdict === "below", "needs_review", budget ? budget.detail : "No budget volunteered");

  // Criterion 5 — decision-maker on the call or represented
  const notDecider = v(e, "decision_maker") === "someone_else";
  const deciderOut = notDecider && v(e, "decider_involved") === false;
  add("R-DM-01", deciderOut, "needs_review",
    !notDecider ? "Caller decides (or not stated)" : deciderOut ? "Caller is researching; the decider is not involved yet" : "Decider is involved or authorised the caller");

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

  const flags = new Set<Flag>();
  if (v(e, "price_asked")) flags.add("price_asked");
  if (priceSpoken) flags.add("price_figure_spoken");
  if (budgetGiven) flags.add("budget_volunteered");
  if (v(e, "referred_by")) flags.add("referral");
  if (v(e, "tenant")) flags.add("tenant");
  if (notDecider) flags.add("caller_not_decision_maker");
  if (v(e, "prior_contact_frustrated")) flags.add("prior_contact_frustrated");
  if (v(e, "later_start_offered") || (weeks !== null && weeks < MIN_LEAD_WEEKS)) flags.add("timeline_reoffer");
  if (v(e, "booked")) flags.add("booked");
  if (type === "home" && sqft !== null && sqft >= PRIORITY_HOME_SQFT) flags.add("priority");

  const missingFields = [
    !hasLocation && "location",
    !type && "project type",
    !scope && "scope",
    !v(e, "timeline") && "timeline",
    !v(e, "caller_name") && "name",
  ].filter(Boolean) as string[];

  return { status, ruleIds: fired.map((r) => r.ruleId), flags: [...flags], missingFields, evaluations: evals };
}
