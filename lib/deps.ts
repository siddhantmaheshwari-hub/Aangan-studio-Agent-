// Builds the pipeline's dependencies from env. Used by API routes and scripts.
import { env, type Env } from "./env";
import { fakeExtractor } from "./extract/fake";
import { DEFAULT_GEMINI_MODEL, geminiExtractor } from "./extract/gemini";
import { hubspotClient } from "./hubspot";
import { type Channels, resendChannel, telegramChannel } from "./notify";
import type { PipelineDeps } from "./pipeline";
import { neonStore } from "./store/neon";
import type { Store } from "./store/types";
import { vaaniClient } from "./vaani";

export function getStore(e: Env = env()): Store {
  if (!e.databaseUrl) throw new Error("DATABASE_URL is not set");
  return neonStore(e.databaseUrl);
}

export function getChannels(e: Env = env()): Channels {
  return {
    email: resendChannel(e.resendApiKey, e.resendFrom),
    telegram: telegramChannel(e.telegramToken, e.telegramChatId),
    recipients: { handoff: e.handoffTo ?? null, escalation: e.escalationTo ?? null, founder: e.founderEmail ?? null },
    telegramMode: e.telegramMode,
  };
}

export function getVaani(e: Env = env()) {
  if (!e.vaaniApiKey) throw new Error("VAANI_API_KEY is not set");
  return vaaniClient(e.vaaniBaseUrl, e.vaaniApiKey);
}

export function getDeps(opts: { store?: Store; dryRun?: boolean; fake?: boolean } = {}, e: Env = env()): PipelineDeps {
  if (!opts.fake && !e.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  return {
    store: opts.store ?? getStore(e),
    extractor: opts.fake ? fakeExtractor : geminiExtractor(e.geminiApiKey!, e.geminiModel ?? DEFAULT_GEMINI_MODEL),
    channels: opts.dryRun ? null : getChannels(e),
    hubspot: opts.dryRun ? null : hubspotClient(e.hubspotToken, e.hubspotPipelineId),
    geminiPriceInrPer1M: { input: e.geminiInPer1M, output: e.geminiOutPer1M },
    budgetFloorInr: e.budgetFloorInr,
    dashboardUrl: e.appUrl,
  };
}
