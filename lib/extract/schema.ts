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
export const SCOPES = ["design_and_execution", "advice_only", "unclear"] as const;
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
  site_status: field(str),
  timeline: field(str),
  completion_within_weeks: field(num),
  later_start_offered: field(bool),
  later_start_accepted: field(bool),
  decision_maker: field(z.enum(DECIDERS)),
  tenant: field(bool),
  budget_volunteered: field(bool),
  budget_min_inr: field(num),
  budget_max_inr: field(num),
  price_asked: field(bool),
  existing_client_complaint: field(bool),
  asks_for_senior: field(bool),
  prior_contact_frustrated: field(bool),
  booked: field(bool),
  summary: z.string(),
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
  property_type: "home (flat, villa, bungalow, any residence) | office (any workspace incl. coworking) | hospitality (restaurant, cafe, hotel) | fitness (gym, studio) | retail (shop, showroom) | other.",
  property_detail: "Short description, e.g. '3BHK flat', 'villa G+2', 'startup office'.",
  size_sqft: "Size in square feet as a number, if said.",
  bhk: "Number of bedrooms (BHK) as a number, if said.",
  scope: "design_and_execution if they want a project done (redesign, fitout, kitchen, wardrobes...). advice_only if they explicitly want only ideas/suggestions/consultation without doing the work. unclear otherwise.",
  rooms: "Which rooms/areas they want done.",
  site_status: "Empty, lived-in, bare shell, under possession, etc.",
  timeline: "When they want the work finished, in their words.",
  completion_within_weeks: "If they need the work FINISHED by a date, the number of weeks from the call date to that date. null if no finish date, or only a start date. Use durations stated in the call over your own calendar (if the agent says 'Diwali is three weeks away', use 3).",
  later_start_offered: "true if the agent offered a later start because the timeline was too short.",
  later_start_accepted: "true if the caller clearly accepted the later start; false if they declined or deferred ('let me think'); null if not offered.",
  decision_maker: "caller (caller decides, alone or 'me and my husband') | caller_with_partner (same, explicitly joint) | someone_else (caller is not the decider, e.g. a son calling for parents).",
  tenant: "true if the caller rents the property.",
  budget_volunteered: "true only if the CALLER stated their own budget figure.",
  budget_min_inr: "Lower end of the caller's budget in rupees (1.5 lakh = 150000).",
  budget_max_inr: "Upper end of the caller's budget in rupees.",
  price_asked: "true only if the caller asked Aangan for a cost figure, rate, range, ballpark or estimate. Stating their own budget, or asking whether a budget is enough, is false.",
  existing_client_complaint: "true if the caller is an EXISTING client complaining about an ongoing project.",
  asks_for_senior: "true if the caller asks to speak to Nikhil, the founder, or someone senior. Merely mentioning Nikhil (e.g. 'a friend of Nikhil's') is false.",
  prior_contact_frustrated: "true if a NEW enquirer says they contacted Aangan before and nobody followed up, and is unhappy about it. Existing clients complaining about their project are existing_client_complaint, not this.",
  booked: "true only if the agent confirmed a specific date AND time for the consultation during the call. 'Let's book it', 'shall I set up a consultation', 'what days work for you' or 'I'll check the calendar' are all false. Agreeing to 'set something up' without a confirmed slot is false.",
};
