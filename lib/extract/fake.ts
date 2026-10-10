// Fake extractor: hand-labelled facts per fixture. Lets us test the deterministic pipeline
// (rules, locality, price scan, storage, notifications) without spending Gemini tokens.
import { type Extraction, type FieldName, emptyExtraction } from "./schema";
import type { Extractor } from "./types";

type Label = Partial<Record<FieldName, [unknown, string | null] | unknown>> & { summary?: string };

/** Build an extraction from {field: value} or {field: [value, quote]}. */
function build(label: Label): Extraction {
  const e = emptyExtraction() as Record<string, unknown>;
  for (const [k, raw] of Object.entries(label)) {
    if (k === "summary") e.summary = raw;
    else if (Array.isArray(raw) && raw.length === 2 && (typeof raw[1] === "string" || raw[1] === null))
      e[k] = { value: raw[0], quote: raw[1] };
    else e[k] = { value: raw, quote: null };
  }
  return e as Extraction;
}

const DE = "design_and_execution";

export const FAKE_LABELS: Record<string, Label> = {
  T01: { caller_name: ["Priya", "I'm Priya"], referred_by: ["Shruti Joshi", "from a friend — Shruti Joshi"], heard_via: "friend",
    locality: ["Kothrud", "3BHK in Kothrud — Dahanukar Colony"], property_type: "home", property_detail: "3BHK flat", bhk: 3,
    size_sqft: [1400, "About 1,400 sq ft carpet."], scope: [DE, "redo the whole thing — kitchen, living room, both bedrooms"],
    rooms: "kitchen, living room, both bedrooms", timeline: ["by March", "We'd like to be done by March"],
    completion_within_weeks: 26, decision_maker: "caller_with_partner", summary: "Referral from Shruti Joshi. Full 3BHK redo in Kothrud by March." },
  T02: { heard_via: "Instagram", locality: ["Wakad", "a 2BHK in Wakad"], property_type: "home", bhk: 2, size_sqft: 950, scope: [DE, "Full redesign"],
    rooms: "kitchen, wardrobes, living room, both bedrooms", timeline: ["move in November", "We move in November"], completion_within_weeks: 9,
    price_asked: [true, "can you give me a rough ballpark first? Even a range?"], summary: "2BHK Wakad full redesign; asked for price twice; agreed to consult." },
  T03: { caller_name: "Suresh Patil", heard_via: "LinkedIn", locality: ["Nashik", "I'm in Nashik"], other_city: ["Nashik", "I'm in Nashik"],
    property_type: "home", scope: DE, rooms: "home office and study", summary: "Nashik home office project; outside service area." },
  T04: { property_type: "home", scope: ["advice_only", "Just want suggestions on colours, furniture arrangement"], rooms: "living room",
    summary: "Wants suggestions only for living room; no execution." },
  T05: { caller_name: "Aarti Mehta", referred_by: ["Vikram Agarwal", "Vikram Agarwal asked me to call"], locality: ["Koregaon Park", "4BHK in Koregaon Park"],
    property_type: "home", bhk: 4, size_sqft: 2400, scope: [DE, "Complete redesign"], site_status: "moved out temporarily",
    timeline: ["by February", "move back in by February"], completion_within_weeks: 21, summary: "Referral; 4BHK KP complete redesign by Feb." },
  T06: { locality: ["Baner", "office space in Baner"], property_type: ["office", "first proper office space"], size_sqft: 800, scope: [DE, "Full fitout"],
    site_status: "bare shell", timeline: ["by December", "operational by December"], completion_within_weeks: 12, decision_maker: "caller",
    summary: "Startup office 800 sq ft in Baner; full fitout by December." },
  T07: { property_type: "home", scope: DE, rooms: "living room and kitchen", timeline: ["before Diwali", "redo my living room and kitchen before Diwali"],
    completion_within_weeks: 3, later_start_offered: true, later_start_accepted: [false, "Let me think and call back."],
    summary: "Wants living room + kitchen before Diwali (~3 weeks); offered November start; undecided." },
  T09: { caller_name: "Sheetal Deshpande", locality: "Viman Nagar", property_type: "home", bhk: 2,
    existing_client_complaint: [true, "my designer hasn't replied in five days"], asks_for_senior: [true, "I want it from Nikhil or a senior person"],
    summary: "Existing client, designer Aryan unresponsive 5 days; wants Nikhil/senior callback." },
  T10: { locality: "Kharadi", property_type: "home", bhk: 1, size_sqft: 550, scope: DE, rooms: "kitchen and one bedroom",
    budget_volunteered: [true, "My budget is 1 to 1.5 lakh maximum"], budget_min_inr: 100000, budget_max_inr: 150000,
    summary: "1BHK Kharadi kitchen + bedroom; volunteered budget 1–1.5 lakh." },
  T11: { locality: "Baner", property_type: "home", bhk: 2, scope: DE, rooms: "living room, bedroom, kitchen", tenant: [true, "I'm in a rented apartment"],
    summary: "Tenant, 2BHK Baner, landlord OK; living, bedroom, kitchen." },
  T12: { caller_name: "Anand Sharma", locality: "Kalyani Nagar", property_type: "home", property_detail: "villa G+2", size_sqft: 5500, scope: DE,
    site_status: "new construction, empty", timeline: "March next year", completion_within_weeks: 25, summary: "5,500 sq ft villa, Kalyani Nagar, full design by March." },
  T13: { locality: "Aundh", property_type: "home", bhk: 3, size_sqft: 1100, scope: DE, rooms: "kitchen, wardrobes, living room",
    price_asked: [true, "can't you give me even a rough range?"], summary: "3BHK Aundh; pushed for a price range; agreed to book." },
  T14: { locality: "Hadapsar", property_type: "home", bhk: 3, scope: DE, site_status: "new possession",
    decision_maker: ["someone_else", "I'll tell them about the consultation and they'll decide"], summary: "Son enquiring for parents' 3BHK in Hadapsar; parents decide." },
  T15: { caller_name: "Smita", locality: "Undri", property_type: "home", bhk: 2, size_sqft: 875, scope: [DE, "The full package"],
    timeline: "possession in six weeks; start design now", decision_maker: "caller_with_partner", summary: "2BHK Undri full home; possession in 6 weeks." },
  T16: { caller_name: "Girish Nair", locality: "Viman Nagar", property_type: "home", bhk: 3,
    prior_contact_frustrated: [true, "Someone said they'd get back to me. It's been two days."], summary: "Called Monday, no follow-up; 3BHK Viman Nagar." },
  T17b: { caller_name: "Ritu Kapoor", locality: "Pimple Saudagar", property_type: "home", bhk: 3, size_sqft: 1050, scope: DE,
    rooms: "kitchen, wardrobes, living room", timeline: "by March", completion_within_weeks: 23, summary: "Called back after drop; 3BHK Pimple Saudagar by March." },
  T18: { property_type: ["office", "I run a small coworking space"], size_sqft: [180, "180 sq ft pod"], scope: DE, summary: "180 sq ft coworking pod." },
  T19: { locality: "Koregaon Park", property_type: ["hospitality", "open a restaurant in Koregaon Park"], scope: DE, summary: "Restaurant in KP." },
  T20: { caller_name: "Pooja", locality: "Magarpatta", property_type: "home", bhk: 2, size_sqft: 900, scope: DE,
    rooms: "kitchen, both bedrooms, living room", timeline: "January start for execution", decision_maker: "caller_with_partner",
    summary: "2BHK Magarpatta; January execution start." },
  S01: { caller_name: "Neha", locality: "Baner", property_type: "home", bhk: 2, size_sqft: 900, scope: DE, timeline: "by March",
    completion_within_weeks: 24, price_asked: true, summary: "Synthetic: agent quoted a per-sq-ft rate." },
  S02: { locality: ["Hinjawadi", "mera flat Hinjawadi mein hai"], property_type: "home", bhk: 2, scope: [DE, "poora interior karwana hai"],
    timeline: "January tak", completion_within_weeks: 14, summary: "Synthetic: Hinglish, 2BHK in Hinjawadi." },
};


/** The hand-labelled extraction for a fixture — also the gold standard for grading Gemini. */
export function goldExtraction(fixtureId: string): Extraction | null {
  const label = FAKE_LABELS[fixtureId];
  return label ? build(label) : null;
}

export const fakeExtractor: Extractor = {
  name: "fake",
  async extract({ fixtureId }) {
    const label = fixtureId ? FAKE_LABELS[fixtureId] : undefined;
    if (!label) throw new Error(`fake extractor has no label for ${fixtureId ?? "unknown call"}`);
    return { extraction: build(label), usage: null };
  },
};
