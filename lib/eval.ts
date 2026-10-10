// Grades an AI extraction against the hand-labelled gold extraction, field by field.
// Only fields that can change a status or a flag are graded.
import { normaliseLocality } from "./locality";
import type { Extraction, FieldName } from "./extract/schema";

const BOOLS: FieldName[] = ["tenant", "budget_volunteered", "price_asked", "existing_client_complaint", "asks_for_senior", "prior_contact_frustrated", "later_start_accepted", "booked"];

export const GRADED: FieldName[] = [
  "locality", "other_city", "property_type", "scope", "size_sqft", "completion_within_weeks", "decision_maker", "referred_by", ...BOOLS,
];

const val = (e: Extraction, k: FieldName) => e[k]?.value ?? null;

/** true = match. Rules are deliberately lenient where the rules engine is. */
export function fieldMatches(k: FieldName, gold: Extraction, got: Extraction): boolean {
  const g = val(gold, k), a = val(got, k);
  if (BOOLS.includes(k)) return (g === true) === (a === true);
  if (k === "locality") {
    const area = (e: Extraction) => normaliseLocality((val(e, "locality") ?? val(e, "other_city")) as string | null).normalised;
    return area(gold) === area(got);
  }
  if (k === "referred_by" || k === "other_city") return Boolean(g) === Boolean(a);
  if (k === "decision_maker") return (g === "someone_else") === (a === "someone_else");
  if (k === "completion_within_weeks") {
    if (g === null || a === null) return g === a || (g !== null && (g as number) >= 8 && a === null);
    return ((g as number) < 8) === ((a as number) < 8); // only the 8-week threshold matters (R-TIME-01)
  }
  if (k === "size_sqft") {
    if (g === null || a === null) return g === a;
    return Math.abs((g as number) - (a as number)) <= 0.1 * (g as number);
  }
  return g === a;
}

export function gradeExtractions(pairs: { id: string; gold: Extraction; got: Extraction }[]) {
  const perField = GRADED.map((k) => {
    const misses = pairs.filter((p) => !fieldMatches(k, p.gold, p.got)).map((p) => p.id);
    return { field: k, correct: pairs.length - misses.length, total: pairs.length, misses };
  });
  const correct = perField.reduce((s, f) => s + f.correct, 0);
  const total = perField.reduce((s, f) => s + f.total, 0);
  return { perField, accuracy: total ? correct / total : 1 };
}
