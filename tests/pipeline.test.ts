import { describe, expect, it } from "vitest";
import { fakeExtractor } from "@/lib/extract/fake";
import { checkExpected, FIXTURES } from "@/lib/fixtures";
import type { HubSpotClient } from "@/lib/hubspot";
import type { Channels } from "@/lib/notify";
import { type PipelineDeps, processCall } from "@/lib/pipeline";
import { MemoryStore } from "@/lib/store/memory";

async function replayAll(deps: PipelineDeps) {
  const out: Record<string, Awaited<ReturnType<typeof processCall>>> = {};
  for (const f of FIXTURES) out[f.fixtureId] = await processCall(deps, f.call, { fixtureId: f.fixtureId });
  return out;
}

function fakeChannels(opts: { emailFails?: boolean; telegram?: "ok" | "fail" | "off" } = {}) {
  const sent: { channel: string; subject: string }[] = [];
  const ch: Channels = {
    email: {
      configured: true,
      async send(_to, subject) {
        if (opts.emailFails) return { ok: false, error: "HTTP 500: simulated" };
        sent.push({ channel: "resend", subject });
        return { ok: true, providerId: `re_${sent.length}` };
      },
    },
    telegram: {
      configured: (opts.telegram ?? "off") !== "off",
      async send(text) {
        if (opts.telegram === "fail") return { ok: false, error: "simulated" };
        sent.push({ channel: "telegram", subject: text.split("\n")[0] });
        return { ok: true, providerId: "tg_1" };
      },
    },
    recipients: { handoff: "team@example.com", escalation: "urgent@example.com", founder: "founder@example.com" },
  };
  return { ch, sent };
}

function fakeHubspot() {
  const deals: number[] = [];
  const hs: HubSpotClient = {
    configured: true,
    async createLead(l) {
      deals.push(l.enquiryId);
      return { contactId: "c1", dealId: `d${deals.length}`, dealUrl: null, amountInr: 1_100_000, amountSource: "studio_average", warnings: [] };
    },
  };
  return { hs, deals };
}

describe("fixture replay (fake extractor)", () => {
  it("matches every expected result", async () => {
    const store = new MemoryStore();
    const results = await replayAll({ store, extractor: fakeExtractor, channels: null, hubspot: null });
    const failures = Object.entries(results)
      .map(([id, r]) => [id, checkExpected(id, r)] as const)
      .filter(([, p]) => p.length);
    expect(failures).toEqual([]);
  });

  it("T17a + T17b → one enquiry, two calls", async () => {
    const store = new MemoryStore();
    const r = await replayAll({ store, extractor: fakeExtractor, channels: null, hubspot: null });
    expect(r.T17b.enquiryId).not.toBeNull();
    const calls = store.calls.filter((c) => c.enquiry_id === r.T17b.enquiryId);
    expect(calls.map((c) => c.vaani_call_id).sort()).toEqual(["replay-T17a", "replay-T17b"]);
    expect(store.enquiries.filter((e) => e.caller_number === "+910000000017")).toHaveLength(1);
  });

  it("T08 missed → call row only", async () => {
    const store = new MemoryStore();
    const r = await replayAll({ store, extractor: fakeExtractor, channels: null, hubspot: null });
    expect(r.T08.enquiryId).toBeNull();
    expect(store.calls.find((c) => c.vaani_call_id === "replay-T08")).toBeTruthy();
  });

  it("replaying twice creates no duplicates", async () => {
    const store = new MemoryStore();
    const deps = { store, extractor: fakeExtractor, channels: null, hubspot: null };
    await replayAll(deps);
    const counts = [store.calls.length, store.enquiries.length, store.costEvents.length];
    const second = await replayAll(deps);
    expect([store.calls.length, store.enquiries.length, store.costEvents.length]).toEqual(counts);
    expect(Object.values(second).every((r) => r.skipped)).toBe(true);
  });

  it("every Gemini call writes a cost_event", async () => {
    const store = new MemoryStore();
    const extractor = {
      name: "gemini:test",
      async extract(input: Parameters<typeof fakeExtractor.extract>[0]) {
        const r = await fakeExtractor.extract(input);
        return { ...r, usage: [{ model: "test", inputTokens: 100, outputTokens: 50 }] };
      },
    };
    await replayAll({ store, extractor, channels: null, hubspot: null, geminiPriceInrPer1M: { input: 10, output: 40 } });
    const completedProcessed = store.calls.filter((c) => c.call_outcome === "completed").length;
    expect(store.costEvents).toHaveLength(completedProcessed);
    expect(store.costEvents[0].cost_inr).toBeCloseTo((100 * 10 + 50 * 40) / 1e6);
  });
});

describe("outputs", () => {
  it("qualified → HubSpot deal + handoff; escalation → urgent email, no deal; declines → nothing", async () => {
    const store = new MemoryStore();
    const { ch, sent } = fakeChannels();
    const { hs, deals } = fakeHubspot();
    const r = await replayAll({ store, extractor: fakeExtractor, channels: ch, hubspot: hs });
    const qualified = Object.values(r).filter((x) => x.status === "qualified").map((x) => x.enquiryId);
    expect(deals.sort()).toEqual([...qualified].sort());
    expect(deals).not.toContain(r.T09.enquiryId);
    expect(store.notifications.filter((n) => n.kind === "escalation" && n.ok).map((n) => n.enquiry_id)).toEqual([r.T09.enquiryId]);
    expect(store.notifications.some((n) => n.enquiry_id === r.T19.enquiryId)).toBe(false);
    expect(sent.filter((s) => s.subject.includes("Qualified lead"))).toHaveLength(qualified.length);
    expect(store.enquiries.find((e) => e.id === r.T01.enquiryId)?.handoff_at).toBeTruthy();
  });

  it("Resend fails → one retry → Telegram fallback; both recorded", async () => {
    const store = new MemoryStore();
    const { ch } = fakeChannels({ emailFails: true, telegram: "ok" });
    const t01 = FIXTURES.find((f) => f.fixtureId === "T01")!;
    const r = await processCall({ store, extractor: fakeExtractor, channels: ch, hubspot: null }, t01.call, { fixtureId: "T01" });
    const n = store.notifications.filter((x) => x.enquiry_id === r.enquiryId && x.kind === "handoff");
    expect(n.map((x) => [x.channel, x.attempt, x.ok])).toEqual([["resend", 1, false], ["resend", 2, false], ["telegram", 3, true]]);
    expect(store.enquiries[0].handoff_at).toBeTruthy();
  });

  it("Resend and Telegram both fail → pipeline_errors row, not delivered", async () => {
    const store = new MemoryStore();
    const { ch } = fakeChannels({ emailFails: true, telegram: "fail" });
    const t01 = FIXTURES.find((f) => f.fixtureId === "T01")!;
    await processCall({ store, extractor: fakeExtractor, channels: ch, hubspot: null }, t01.call, { fixtureId: "T01" });
    expect(store.notifications.every((x) => !x.ok)).toBe(true);
    expect(store.errors.some((e) => e.step === "notify:handoff")).toBe(true);
    expect(store.enquiries[0].handoff_at).toBeNull();
  });

  it("invalid AI output → needs_review, cost still recorded", async () => {
    const store = new MemoryStore();
    const { ExtractionInvalidError } = await import("@/lib/extract/types");
    const bad = { name: "gemini:bad", async extract(): Promise<never> { throw new ExtractionInvalidError("bad json", [{ model: "m", inputTokens: 1, outputTokens: 1 }, { model: "m", inputTokens: 1, outputTokens: 1 }]); } };
    const t01 = FIXTURES.find((f) => f.fixtureId === "T01")!;
    const r = await processCall({ store, extractor: bad, channels: null, hubspot: null }, t01.call);
    expect(r).toMatchObject({ status: "needs_review", ruleIds: ["R-EXTRACT-01"] });
    expect(store.costEvents).toHaveLength(2);
  });
});
