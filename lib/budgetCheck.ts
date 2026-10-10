// INTERNAL ONLY. Lowest indicative rates from pricing.md, used by code to spot a volunteered budget
// that is "clearly below what any project of their described scope would cost" (qualified.md §4).
// These numbers are never sent to Vaani or Gemini, never spoken to a caller, and never shown on the
// dashboard — the rule detail only says "below the internal minimum".

const RESIDENTIAL_MIN_PER_SQFT = 1800; // pricing.md: residential standard spec, lower bound
const COMMERCIAL_MIN_PER_SQFT = 1200; // pricing.md: commercial basic fitout, lower bound
const SINGLE_ROOM_MIN = 350_000; // pricing.md: single room redesign, lower bound

/** "Clearly below" = under half of the lowest possible cost for the described scope. */
export const CLEARLY_BELOW_RATIO = 0.5;

export type BudgetVerdict = "clearly_below" | "below" | "ok" | "unknown_scope";

export interface BudgetInput {
  budgetMaxInr: number | null;
  budgetMinInr: number | null;
  propertyType: string | null;
  sizeSqft: number | null;
  roomsCount: number | null;
}

/** Lowest plausible cost for the scope, or null if the scope is too vague to judge. */
export function minimumFor(i: BudgetInput): number | null {
  const estimates: number[] = [];
  if (i.sizeSqft) estimates.push(i.sizeSqft * (i.propertyType === "office" ? COMMERCIAL_MIN_PER_SQFT : RESIDENTIAL_MIN_PER_SQFT));
  if (i.roomsCount && i.propertyType !== "office") estimates.push(i.roomsCount * SINGLE_ROOM_MIN);
  // Use the smaller estimate: we only want to catch obvious mismatches, never decline a plausible lead.
  return estimates.length ? Math.min(...estimates) : null;
}

export function checkBudget(i: BudgetInput): { verdict: BudgetVerdict; detail: string } {
  const budget = i.budgetMaxInr ?? i.budgetMinInr;
  if (budget === null) return { verdict: "unknown_scope", detail: "Budget mentioned without a figure" };
  const floor = minimumFor(i) ?? SINGLE_ROOM_MIN; // any project is at least one room
  const basis = minimumFor(i) === null ? "the smallest project Aangan takes (one room)" : "the described scope";
  if (budget < floor * CLEARLY_BELOW_RATIO) return { verdict: "clearly_below", detail: `Caller's budget is under half the internal minimum for ${basis}` };
  if (budget < floor) return { verdict: "below", detail: `Caller's budget is below the internal minimum for ${basis}` };
  if (minimumFor(i) === null) return { verdict: "unknown_scope", detail: "Budget volunteered; scope too vague to compare — treated as qualified (qualified.md: unclear on budget → qualify and note)" };
  return { verdict: "ok", detail: "Caller's budget is within range for the described scope" };
}
