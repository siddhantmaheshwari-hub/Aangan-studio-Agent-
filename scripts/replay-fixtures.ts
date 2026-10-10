// Replays fixture calls through the real pipeline and prints actual vs expected.
//   npm run replay                    fake extractor, in-memory store (no keys needed)
//   npm run replay -- --gemini        Gemini extractor (needs GEMINI_API_KEY)
//   npm run replay -- --db            write to Neon (rows appear on the dashboard as "fixture replay")
//   npm run replay -- --db --send     also send real HubSpot deals + Resend emails (test integrations)
//   npm run replay -- --only T01,T09  subset
import { getDeps } from "../lib/deps";
import { gradeExtractions } from "../lib/eval";
import { goldExtraction } from "../lib/extract/fake";
import type { Extraction } from "../lib/extract/schema";
import { checkExpected, EXPECTED, FIXTURES } from "../lib/fixtures";
import { processCall } from "../lib/pipeline";
import { MemoryStore } from "../lib/store/memory";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;

async function main() {
  const useDb = has("--db");
  const memory = new MemoryStore();
  const deps = getDeps({ store: useDb ? undefined : memory, fake: !has("--gemini"), dryRun: !has("--send") });
  // Capture what the extractor returned per fixture, so a real model can be graded against the gold labels.
  const captured = new Map<string, Extraction>();
  const inner = deps.extractor;
  deps.extractor = {
    name: inner.name,
    async extract(input) {
      const r = await inner.extract(input);
      if (input.fixtureId) captured.set(input.fixtureId, r.extraction);
      return r;
    },
  };
  if (has("--send") && !useDb) throw new Error("--send needs --db (outputs are recorded in Neon)");
  console.log(`extractor=${deps.extractor.name} store=${useDb ? "neon" : "memory"} outputs=${deps.channels ? "LIVE (HubSpot + email)" : "dry run"}\n`);

  const rows: string[][] = [];
  let pass = 0;
  const fixtures = FIXTURES.filter((f) => !only || only.includes(f.fixtureId));
  for (const f of fixtures) {
    const r = await processCall(deps, f.call, { fixtureId: f.fixtureId });
    const problems = r.error ? [`ERROR ${r.error}`] : checkExpected(f.fixtureId, r);
    if (!problems.length) pass++;
    const exp = EXPECTED[f.fixtureId];
    rows.push([
      f.fixtureId,
      `${exp.status} ${(exp.rules ?? []).join(",")} ${(exp.flags ?? []).join(",")}`.trim(),
      `${r.status ?? "-"} ${r.ruleIds.join(",")} ${r.flags.join(",")}`.trim() + (r.skipped ? " (already processed)" : ""),
      problems.length ? `FAIL: ${problems.join("; ")}` : "pass",
    ]);
  }
  const w = [6, 50, 70, 10];
  const line = (c: string[]) => c.map((x, i) => x.padEnd(w[i])).join(" | ");
  console.log(line(["id", "expected", "actual", "result"]));
  console.log(w.map((n) => "-".repeat(n)).join("-|-"));
  rows.forEach((r) => console.log(line(r)));
  console.log(`\n${pass}/${fixtures.length} pass`);

  if (!inner.name.startsWith("fake") && captured.size) {
    const pairs = [...captured].flatMap(([id, got]) => {
      const gold = goldExtraction(id);
      return gold ? [{ id, gold, got }] : [];
    });
    const g = gradeExtractions(pairs);
    console.log(`\nExtraction accuracy vs gold labels: ${(g.accuracy * 100).toFixed(1)}% (${pairs.length} calls)`);
    for (const f of g.perField)
      console.log(`  ${f.field.padEnd(26)} ${f.correct}/${f.total}${f.misses.length ? `  misses: ${f.misses.join(",")}` : ""}`);
  }
  if (!useDb) {
    const tokens = memory.costEvents.reduce((s, c) => s + c.input_tokens + c.output_tokens, 0);
    console.log(`cost_events=${memory.costEvents.length} tokens=${tokens} pipeline_errors=${memory.errors.length}`);
  }
  process.exit(pass === fixtures.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
