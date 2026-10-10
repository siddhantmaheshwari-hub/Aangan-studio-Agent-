// Plain-language labels for codes shown on the dashboard. Codes stay in the database and tooltips.
import { RULES } from "./rules";

export const STATUS_LABEL: Record<string, string> = {
  qualified: "Qualified",
  needs_review: "Needs review",
  incomplete: "Incomplete",
  not_qualified: "Not a fit",
  missed: "Missed",
  escalation: "Escalation",
};

/** What each status means for the team — shown as help text. */
export const STATUS_HELP: Record<string, string> = {
  qualified: "A fit. HubSpot deal + handoff email to the team.",
  needs_review: "Borderline. A person decides; nothing is sent until then.",
  incomplete: "Key facts missing (area or property type). Call back to complete.",
  not_qualified: "Clear no under the rules. Nothing is sent.",
  missed: "Missed or dropped call. Not an enquiry.",
  escalation: "Existing client complaint. Urgent email; never a sales deal.",
};

export const FLAG_LABEL: Record<string, { label: string; help: string; tone: "danger" | "warn" | "neutral" }> = {
  price_figure_spoken: { label: "Agent said a price", help: "The agent spoke a price figure. Must never happen — check the transcript.", tone: "danger" },
  prior_contact_frustrated: { label: "Earlier enquiry not followed up", help: "Caller contacted Aangan before and nobody got back to them.", tone: "warn" },
  price_asked: { label: "Asked for price", help: "Caller asked for a price; the designer should start with it.", tone: "neutral" },
  budget_volunteered: { label: "Gave a budget", help: "Caller stated their own budget.", tone: "neutral" },
  referral: { label: "Referral", help: "Someone referred the caller.", tone: "neutral" },
  tenant: { label: "Tenant", help: "Caller rents the property.", tone: "neutral" },
  caller_not_decision_maker: { label: "Not the decision-maker", help: "Someone else decides; invite them to the consultation.", tone: "neutral" },
  timeline_reoffer: { label: "Later start offered", help: "Timeline was too short; a later start was offered.", tone: "neutral" },
  booked: { label: "Booked in call", help: "A consultation slot was confirmed during the call (per transcript).", tone: "neutral" },
  priority: { label: "Priority (large home)", help: "Home of 3,000 sq ft or more.", tone: "neutral" },
};

export const ruleTitle = (id: string) => RULES[id] ?? (id === "R-EXTRACT-01" ? "AI extraction failed validation twice" : id);

const VALUE_LABEL: Record<string, string> = {
  design_and_execution: "Design + execution",
  advice_only: "Advice only",
  unclear: "Unclear",
  caller: "Caller",
  caller_with_partner: "Caller with partner",
  someone_else: "Someone else",
  home: "Home",
  office: "Office",
  hospitality: "Hospitality",
  fitness: "Gym / fitness",
  retail: "Retail",
  other: "Other",
};

export function formatValue(v: unknown, key?: string): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return key?.includes("inr") ? `₹${v.toLocaleString("en-IN")}` : v.toLocaleString("en-IN");
  return VALUE_LABEL[String(v)] ?? String(v);
}
