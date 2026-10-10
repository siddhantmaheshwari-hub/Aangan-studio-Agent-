// Gemini extractor: facts + caller quotes to a fixed JSON schema, validated with zod, one retry.
// Gemini never decides the status and never sees pricing information.
import { GoogleGenAI } from "@google/genai";
import { ExtractionSchema, FIELD_GUIDE, FIELD_NAMES } from "./schema";
import { type Extractor, ExtractionInvalidError, type TokenUsage } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

function buildPrompt(transcript: [string, string][], callDate: string | null, previousError?: string) {
  const fields = FIELD_NAMES.map((k) => `- ${k}: ${FIELD_GUIDE[k]}`).join("\n");
  const lines = transcript.map(([s, t]) => `${s}: ${t}`).join("\n");
  return `You extract facts from a phone call to Aangan Studio, an interior design studio in Pune.
AGENT is the studio; USER is the caller. The call may mix English, Hindi and Marathi.

Return ONLY a JSON object. For every field below return {"value": ..., "quote": ...}:
- value: the fact, or null if the caller did not say it. Never guess.
- quote: the caller's exact words (from a USER line) supporting the value, max 20 words, or null.
Also return "summary": two short lines for the studio team (no prices).

Call date: ${callDate ?? "unknown"} (use it to compute completion_within_weeks).

Fields:
${fields}
${previousError ? `\nYour previous answer was invalid: ${previousError}\nFix it and return the full JSON again.` : ""}
Transcript:
${lines}`;
}

export function geminiExtractor(apiKey: string, model = DEFAULT_GEMINI_MODEL): Extractor {
  const ai = new GoogleGenAI({ apiKey });
  return {
    name: `gemini:${model}`,
    async extract({ transcript, callDate }) {
      const usage: TokenUsage[] = [];
      let lastError = "";
      for (let attempt = 1; attempt <= 2; attempt++) {
        const res = await ai.models.generateContent({
          model,
          contents: buildPrompt(transcript, callDate, attempt > 1 ? lastError : undefined),
          config: { responseMimeType: "application/json", temperature: 0 },
        });
        usage.push({
          model,
          inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
        });
        try {
          const parsed = ExtractionSchema.safeParse(JSON.parse(res.text ?? ""));
          if (parsed.success) return { extraction: parsed.data, usage };
          lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        } catch (err) {
          lastError = `not valid JSON (${(err as Error).message})`;
        }
      }
      throw new ExtractionInvalidError(`Gemini output failed validation twice: ${lastError}`, usage);
    },
  };
}
