import { describe, expect, it } from "vitest";
import { gradeExtractions } from "@/lib/eval";
import { goldExtraction } from "@/lib/extract/fake";

describe("extraction grader", () => {
  it("gold vs itself scores 100%", () => {
    const pairs = ["T01", "T07", "T10", "S02"].map((id) => ({ id, gold: goldExtraction(id)!, got: goldExtraction(id)! }));
    expect(gradeExtractions(pairs).accuracy).toBe(1);
  });
  it("catches a wrong area and a missed complaint, tolerates harmless differences", () => {
    const gold = goldExtraction("T09")!;
    const got = structuredClone(gold);
    got.locality = { value: "Vimannagar", quote: null }; // alias of Viman Nagar → still correct
    got.existing_client_complaint = { value: false, quote: null }; // wrong
    const r = gradeExtractions([{ id: "T09", gold, got }]);
    expect(r.perField.find((f) => f.field === "locality")!.misses).toEqual([]);
    expect(r.perField.find((f) => f.field === "existing_client_complaint")!.misses).toEqual(["T09"]);
  });
});
