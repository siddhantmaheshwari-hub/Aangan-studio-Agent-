import type { Turn } from "../types";
import type { Extraction } from "./schema";

export interface ExtractInput {
  transcript: Turn[];
  callDate: string | null; // ISO, so "by March" can become weeks
  fixtureId?: string; // replay only (used by the fake extractor)
}

export interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ExtractResult {
  extraction: Extraction;
  /** One entry per model call (a retry adds a second). null for the fake extractor. */
  usage: TokenUsage[] | null;
}

export interface Extractor {
  name: string;
  extract(input: ExtractInput): Promise<ExtractResult>;
}

/** Thrown when the model's output never validates; the pipeline sends the call to needs_review. */
export class ExtractionInvalidError extends Error {
  constructor(message: string, public usage: TokenUsage[]) {
    super(message);
  }
}
