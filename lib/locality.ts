// Locality normalisation: alias table first, then fuzzy match. PROXY lists from CLAUDE.md.

export const IN_AREA = [
  "Kothrud", "Wakad", "Koregaon Park", "Baner", "Viman Nagar", "Kharadi", "Kalyani Nagar",
  "Aundh", "Hadapsar", "Undri", "Pimple Saudagar", "Magarpatta", "Nanded City",
  "Pimple Nilakh", "Chinchwad", "NIBM Road", "Kondhwa", "PCMC",
] as const;

/** Always reviewed by a person. */
export const BORDERLINE = ["Talegaon", "Hinjewadi"] as const;

/** Clearly outside Pune/PCMC. */
export const OTHER_CITIES = [
  "Nashik", "Mumbai", "Thane", "Navi Mumbai", "Bangalore", "Bengaluru", "Hyderabad", "Nagpur",
  "Aurangabad", "Kolhapur", "Satara", "Solapur", "Goa", "Delhi", "Ahmedabad", "Chennai",
  "Lonavala", "Alibaug",
] as const;

/** Common spellings → canonical name. Keys are compared after cleaning (lowercase, letters only). */
const ALIASES: Record<string, string> = {
  hinjawadi: "Hinjewadi",
  hinjewadi: "Hinjewadi",
  hinjawdi: "Hinjewadi",
  "pimpri chinchwad": "PCMC",
  "pimpri-chinchwad": "PCMC",
  pimpri: "PCMC",
  pcmc: "PCMC",
  koregaon: "Koregaon Park",
  "koregaon park": "Koregaon Park",
  kp: "Koregaon Park",
  kalyaninagar: "Kalyani Nagar",
  vimannagar: "Viman Nagar",
  "magarpatta city": "Magarpatta",
  cybercity: "Magarpatta",
  "nibm": "NIBM Road",
  "nanded": "Nanded City",
  bengaluru: "Bangalore",
};

export type LocalityKind = "in_area" | "borderline" | "other_city" | "unknown";

export interface LocalityResult {
  raw: string | null;
  normalised: string | null;
  kind: LocalityKind;
  /** 1 = exact or alias; < 1 = fuzzy; 0 = no match. */
  confidence: number;
}

/** Below this a fuzzy match is not trusted and the call goes to review. */
export const FUZZY_ACCEPT = 0.85;

const clean = (s: string) => s.toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();

function kindOf(name: string): LocalityKind {
  if ((IN_AREA as readonly string[]).includes(name)) return "in_area";
  if ((BORDERLINE as readonly string[]).includes(name)) return "borderline";
  if ((OTHER_CITIES as readonly string[]).includes(name)) return "other_city";
  return "unknown";
}

const ALL_CANONICAL: string[] = [...IN_AREA, ...BORDERLINE, ...OTHER_CITIES];

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function similarity(a: string, b: string): number {
  const x = a.replace(/[\s-]/g, "");
  const y = b.replace(/[\s-]/g, "");
  if (!x.length && !y.length) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

/** Word windows of a phrase, so "Kothrud — Dahanukar Colony" still finds "kothrud". */
function windows(text: string): string[] {
  const words = text.split(" ").filter(Boolean);
  const out: string[] = [];
  for (let n = 1; n <= 3; n++)
    for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(" "));
  return out;
}

export function normaliseLocality(raw: string | null | undefined): LocalityResult {
  if (!raw || !raw.trim()) return { raw: raw ?? null, normalised: null, kind: "unknown", confidence: 0 };
  const text = clean(raw);
  const parts = windows(text);

  // 1. Exact canonical or alias, longest phrase first ("koregaon park" before "koregaon").
  const byLength = [...parts].sort((a, b) => b.length - a.length);
  for (const p of byLength) {
    const canonical = ALL_CANONICAL.find((c) => clean(c) === p) ?? ALIASES[p] ?? ALIASES[p.replace(/ /g, "")];
    if (canonical) return { raw, normalised: canonical, kind: kindOf(canonical), confidence: 1 };
  }

  // 2. Fuzzy: best similarity between any word window and any canonical name or alias.
  let best = { name: "", score: 0 };
  const targets: [string, string][] = [
    ...ALL_CANONICAL.map((c) => [clean(c), c] as [string, string]),
    ...Object.entries(ALIASES),
  ];
  for (const p of parts)
    for (const [key, name] of targets) {
      const s = similarity(p, key);
      if (s > best.score) best = { name, score: s };
    }

  if (best.score >= 0.7)
    return {
      raw,
      normalised: best.name,
      kind: best.score >= FUZZY_ACCEPT ? kindOf(best.name) : "unknown",
      confidence: Number(best.score.toFixed(2)),
    };
  return { raw, normalised: null, kind: "unknown", confidence: 0 };
}
