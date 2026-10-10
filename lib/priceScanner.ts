// Scans AGENT turns for any spoken price figure. Rule 1: no price figures, ever.
import type { Turn } from "./types";

export interface PriceHit {
  turnIndex: number;
  text: string;
  match: string;
}

// A number, optionally with decimals, commas, or a range ("1 to 1.5", "8-14").
const NUM = String.raw`\d[\d,]*(?:\.\d+)?(?:\s*(?:-|–|to)\s*\d[\d,]*(?:\.\d+)?)?`;
const WORD_NUM = String.raw`(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|fifty|hundred)`;

const PATTERNS: RegExp[] = [
  // ₹1,800 / Rs. 2000 / INR 5000
  new RegExp(String.raw`(?:₹|\brs\.?|\binr)\s*${NUM}`, "i"),
  // 1,800 rupees / 5 lakh / 1.5 lakhs / 2 crore / 12 lacs
  new RegExp(String.raw`\b${NUM}\s*(?:rupees?|lakhs?|lacs?|lakh rupees|crores?|cr\b|l\b)`, "i"),
  new RegExp(String.raw`\b${WORD_NUM}\s+(?:lakhs?|lacs?|crores?|thousand rupees|hundred rupees)`, "i"),
  // 1800 per sq ft / 1,800 a square foot / 2k per sqft
  new RegExp(String.raw`\b${NUM}\s*k?\s*(?:per|a|\/)\s*(?:sq\.?\s*ft|sqft|square\s*f(?:oo|ee)t)`, "i"),
  // 50k / 80 thousand (only when money words are nearby)
  new RegExp(String.raw`\b${NUM}\s*(?:k|thousand)\b(?=[^.]{0,40}\b(?:cost|price|budget|rupees|charge|fee|spend)\b)`, "i"),
  new RegExp(String.raw`\b(?:cost|price|budget|charge|fee|starts? at|around|about)\b[^.]{0,20}\b${NUM}\s*(?:k|thousand)\b`, "i"),
];

export function scanAgentTurns(transcript: Turn[]): PriceHit[] {
  const hits: PriceHit[] = [];
  transcript.forEach(([speaker, text], turnIndex) => {
    if (speaker !== "AGENT") return;
    for (const re of PATTERNS) {
      const m = text.match(re);
      if (m) {
        hits.push({ turnIndex, text, match: m[0].trim() });
        return;
      }
    }
  });
  return hits;
}
