import { describe, expect, it } from "vitest";
import { emptyExtraction } from "@/lib/extract/schema";
import { normaliseLocality } from "@/lib/locality";
import { scanAgentTurns } from "@/lib/priceScanner";
import { evaluate } from "@/lib/rules";
import { dealAmount, STUDIO_AVERAGE_INR } from "@/lib/hubspot";

describe("locality", () => {
  it("normalises aliases", () => {
    expect(normaliseLocality("Hinjawadi")).toMatchObject({ normalised: "Hinjewadi", kind: "borderline", confidence: 1 });
    expect(normaliseLocality("Pimpri Chinchwad")).toMatchObject({ normalised: "PCMC", kind: "in_area" });
    expect(normaliseLocality("Koregaon")).toMatchObject({ normalised: "Koregaon Park", kind: "in_area" });
  });
  it("finds the area inside a longer phrase", () => {
    expect(normaliseLocality("3BHK in Kothrud — Dahanukar Colony")).toMatchObject({ normalised: "Kothrud", kind: "in_area" });
  });
  it("fuzzy-matches small misspellings", () => {
    const r = normaliseLocality("Kotrud");
    expect(r.normalised).toBe("Kothrud");
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });
  it("treats weak matches and unknown areas as unknown", () => {
    expect(normaliseLocality("Lohegaon").kind).toBe("unknown");
    expect(normaliseLocality("")).toMatchObject({ normalised: null, kind: "unknown" });
  });
  it("recognises other cities", () => {
    expect(normaliseLocality("Nashik").kind).toBe("other_city");
  });
});

describe("price scanner (agent turns only)", () => {
  const hit = (t: string) => scanAgentTurns([["AGENT", t]]).length > 0;
  it("catches price figures", () => {
    expect(hit("We usually charge ₹1,800 per sq ft.")).toBe(true);
    expect(hit("It is around 1800 per square foot")).toBe(true);
    expect(hit("Projects like this are 8 to 14 lakh.")).toBe(true);
    expect(hit("About Rs. 50000 for the kitchen")).toBe(true);
    expect(hit("roughly five lakhs")).toBe(true);
    expect(hit("the budget would be about 80k")).toBe(true);
  });
  it("ignores non-price numbers", () => {
    expect(hit("Design takes 3–4 weeks and execution 8–10 weeks.")).toBe(false);
    expect(hit("We do commercial fitouts up to about 3,000 sq ft.")).toBe(false);
    expect(hit("A standard and a premium kitchen can differ 3× the cost.")).toBe(false);
    expect(hit("Would 11am on the 14th work?")).toBe(false);
  });
  it("never scans the caller", () => {
    expect(scanAgentTurns([["USER", "My budget is ₹5 lakh"]])).toHaveLength(0);
  });
});

describe("rules", () => {
  const base = () => {
    const e = emptyExtraction();
    e.locality = { value: "Baner", quote: null };
    e.property_type = { value: "home", quote: null };
    e.scope = { value: "design_and_execution", quote: null };
    return e;
  };
  const run = (e = base(), extra: Partial<Parameters<typeof evaluate>[0]> = {}) =>
    evaluate({ extraction: e, locality: normaliseLocality(e.locality.value ?? e.other_city.value), priceHits: [], ...extra });

  it("qualifies a complete in-area home", () => expect(run().status).toBe("qualified"));
  it("escalation beats everything", () => {
    const e = base();
    e.existing_client_complaint = { value: true, quote: null };
    e.other_city = { value: "Nashik", quote: null };
    expect(run(e).status).toBe("escalation");
  });
  it("accepted later start is not a decline", () => {
    const e = base();
    e.completion_within_weeks = { value: 3, quote: null };
    e.later_start_offered = { value: true, quote: null };
    e.later_start_accepted = { value: true, quote: null };
    const r = run(e);
    expect(r.status).toBe("qualified");
    expect(r.flags).toContain("timeline_reoffer");
  });
  it("big office goes to review, not declined", () => {
    const e = base();
    e.property_type = { value: "office", quote: null };
    e.size_sqft = { value: 4000, quote: null };
    expect(run(e)).toMatchObject({ status: "needs_review", ruleIds: ["R-SIZE-02"] });
  });
  it("budget above a configured floor passes", () => {
    const e = base();
    e.budget_volunteered = { value: true, quote: null };
    e.budget_max_inr = { value: 1_500_000, quote: null };
    expect(run(e, { budgetFloorInr: 800_000 }).status).toBe("qualified");
    expect(run(e).status).toBe("needs_review");
  });
  it("missing location → incomplete; missing timeline only shows as missing", () => {
    const e = base();
    e.locality = { value: null, quote: null };
    expect(run(e).status).toBe("incomplete");
    const r = run();
    expect(r.status).toBe("qualified");
    expect(r.missingFields).toContain("timeline");
  });
  it("records every rule, fired or not", () => {
    expect(run().evaluations.length).toBeGreaterThanOrEqual(13);
  });
});

describe("deal amount", () => {
  it("uses caller budget midpoint, else studio average", () => {
    expect(dealAmount(800_000, 1_200_000)).toEqual({ amount: 1_000_000, source: "caller_budget" });
    expect(dealAmount(null, null)).toEqual({ amount: STUDIO_AVERAGE_INR, source: "studio_average" });
  });
});
