import { z } from "zod";

// Every extracted field carries the caller's own words, so the founder can check it.
const field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value: value.nullable(), quote: z.string().nullable() });

// Models sometimes return "1,400" or "true" as strings; accept those, reject anything else.
const num = z.preprocess(
  (x) => (typeof x === "string" && x.trim() !== "" && !isNaN(Number(x.replace(/,/g, ""))) ? Number(x.replace(/,/g, "")) : x),
  z.number(),
);
const bool = z.preprocess((x) => (x === "true" ? true : x === "false" ? false : x), z.boolean());
// Lists like ["kitchen", "bedroom"] become "kitchen, bedroom" instead of failing validation.
const str = z.preprocess((x) => (Array.isArray(x) && x.every((i) => typeof i === "string") ? x.join(", ") : x), z.string());

export const PROPERTY_TYPES = ["home", "office", "hospitality", "fitness", "retail", "other"] as const;
// services.md "What we don't do": decor/advice only, standalone furniture sourcing, Vastu only, structural/architecture work.
export const SCOPES = ["design_and_execution", "advice_only", "furniture_only", "vastu_only", "structural_only", "unclear"] as const;
export const DECIDERS = ["caller", "caller_with_partner", "someone_else"] as const;

export const ExtractionSchema = z.object({
  caller_name: field(str),
  referred_by: field(str),
  heard_via: field(str),
  locality: field(str),
  other_city: field(str),
  property_type: field(z.enum(PROPERTY_TYPES)),
  property_detail: field(str),
  size_sqft: field(num),
  bhk: field(num),
  scope: field(z.enum(SCOPES)),
  rooms: field(str),
  rooms_count: field(num),
  structural_changes: field(bool),
  site_status: field(str),
  site_available_in_weeks: field(num),
  timeline: field(str),
  completion_within_weeks: field(num),
  later_start_offered: field(bool),
  later_start_accepted: field(bool),
  decision_maker: field(z.enum(DECIDERS)),
  decider_involved: field(bool),
  tenant: field(bool),
  budget_volunteered: field(bool),
  budget_min_inr: field(num),
  budget_max_inr: field(num),
  price_asked: field(bool),
  existing_client_complaint: field(bool),
  asks_for_senior: field(bool),
  prior_contact_frustrated: field(bool),
  booked: field(bool),
  // The 2-line summary sometimes arrives as ["line 1", "line 2"].
  summary: z.preprocess((x) => (Array.isArray(x) ? x.map(String).join("\n") : x), z.string()),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type FieldName = Exclude<keyof Extraction, "summary">;

export const FIELD_NAMES = Object.keys(ExtractionSchema.shape).filter(
  (k) => k !== "summary",
) as FieldName[];

/** The value of a field, or null. */
export function v<K extends FieldName>(e: Extraction, k: K): Extraction[K]["value"] {
  return e[k]?.value ?? null;
}

/** An extraction with every field missing — the base for building one. */
export function emptyExtraction(): Extraction {
  const out: Record<string, unknown> = { summary: "" };
  for (const k of FIELD_NAMES) out[k] = { value: null, quote: null };
  return out as Extraction;
}

/** Plain-language guide for each field, used in the Gemini prompt. */
export const FIELD_GUIDE: Record<FieldName, string> = {
  caller_name: "Caller's name as they said it.",
  referred_by: "Name of the person who referred them, exactly as said. null if none.",
  heard_via: "How they heard about Aangan (friend, Instagram, LinkedIn...).",
  locality: "The property's area/locality as the caller said it (e.g. 'Kothrud', 'Hinjawadi').",
  other_city: "If the property is clearly in a city other than Pune/PCMC, that city (e.g. 'Nashik'). Otherwise null.",
  property_type: "home (flat, villa, bungalow, independent house, any residence) | office (any commercial workspace: office, clinic, design/work studio, coworking) | hospitality (restaurant, cafe, hotel) | fitness (gym, fitness centre) | retail (shop, store, showroom) | other.",
  property_detail: "Short description, e.g. '3BHK flat', 'villa G+2', 'startup office'.",
  size_sqft: "Size in square feet as a number, if said.",
  bhk: "Number of bedrooms (BHK) as a number, if said.",
  scope: "design_and_execution if they want a project designed and carried out (redesign, fitout, kitchen, wardrobes...). advice_only if they only want ideas, suggestions, decor/styling advice or a consultation and will not have Aangan execute. furniture_only if they only want furniture sourced/bought with no design project. vastu_only if they only want Vastu advice. structural_only if they mainly want walls moved, structural or architectural work, or permits. unclear otherwise.",
  rooms: "Which rooms/areas they want done.",
  rooms_count: "How many rooms/areas are in scope, counting a kitchen as one (e.g. 'kitchen and one bedroom' = 2). null for a full home unless they list the rooms.",
  structural_changes: "true ONLY if the caller wants walls removed/moved, columns/beams/slabs changed, or anything needing structural permits. New flooring, kitchens, wardrobes, false ceilings, lighting and a 'complete redesign' are NOT structural. false if they say no structural changes. null if not discussed.",
  site_status: "Empty, lived-in, bare shell, under possession, etc.",
  site_available_in_weeks: "Weeks from the call date until the site is available for work to start (e.g. possession in 6 weeks = 6; 'we move out in February' = weeks until February). 0 if available now. null if not discussed.",
  timeline: "When they want the work finished, in their words.",
  completion_within_weeks: "If they need the work FINISHED by a date, the number of weeks from the call date to that date. null if no finish date, or only a start date. Use durations stated in the call over your own calendar (if the agent says 'Diwali is three weeks away', use 3).",
  later_start_offered: "true if the agent offered a later start because the timeline was too short.",
  later_start_accepted: "true if the caller clearly accepted the later start; false if they declined or deferred ('let me think'); null if not offered.",
  decision_maker: "caller (caller decides, alone or 'me and my husband') | caller_with_partner (same, explicitly joint) | someone_else (caller is not the decider, e.g. a son calling for parents).",
  decider_involved: "Only when decision_maker is someone_else: true if the decider has authorised the caller or will attend/decide at the consultation; false if the caller is only researching and the decider is not involved yet; null if unclear.",
  tenant: "true if the caller rents the property.",
  budget_volunteered: "true only if the CALLER stated their own budget figure.",
  budget_min_inr: "Lower end of the caller's budget in rupees (1.5 lakh = 150000).",
  budget_max_inr: "Upper end of the caller's budget in rupees.",
  price_asked: "true only if the caller asked Aangan for a cost figure, rate, range, ballpark or estimate. Stating their own budget, or asking whether a budget is enough, is false.",
  existing_client_complaint: "true if the caller is an EXISTING client complaining about an ongoing project.",
  asks_for_senior: "true only if the CALLER demands to speak to Nikhil, the founder or a senior person (usually because of a problem). Accepting the agent's offer of a principal/senior designer for a consultation is false. Merely mentioning Nikhil (e.g. 'a friend of Nikhil's') is false.",
  prior_contact_frustrated: "true if a NEW enquirer says they contacted Aangan before and nobody followed up, and is unhappy about it. Existing clients complaining about their project are existing_client_complaint, not this.",
  booked: "true only if the agent confirmed a specific date AND time for the consultation during the call. 'Let's book it', 'shall I set up a consultation', 'what days work for you' or 'I'll check the calendar' are all false. Agreeing to 'set something up' without a confirmed slot is false.",
};
