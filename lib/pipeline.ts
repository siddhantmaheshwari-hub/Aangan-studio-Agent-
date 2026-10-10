// After-call pipeline. Idempotent by Vaani call_id: a processed call is skipped on replay.
// Order: save raw call → extract → normalise locality → rules + price scan → store → outputs.
import { type Extraction, v } from "./extract/schema";
import { type Extractor, ExtractionInvalidError, type TokenUsage } from "./extract/types";
import type { HubSpotClient } from "./hubspot";
import { normaliseLocality } from "./locality";
import { type Channels, deliver } from "./notify";
import { scanAgentTurns } from "./priceScanner";
import { type RuleEvaluation, evaluate } from "./rules";
import type { CallRow, EnquiryRow, Store } from "./store/types";
import type { IncomingCall, Status, Turn } from "./types";

export interface PipelineDeps {
  store: Store;
  extractor: Extractor;
  /** null = dry run: no emails, no HubSpot (used for fixture replays). */
  channels: Channels | null;
  hubspot: HubSpotClient | null;
  geminiPriceInrPer1M?: { input: number | null; output: number | null };
  budgetFloorInr?: number | null;
  dashboardUrl?: string | null;
}

export interface ProcessResult {
  callId: number;
  skipped: boolean;
  enquiryId: number | null;
  status: Status | "missed" | null;
  ruleIds: string[];
  flags: string[];
  error?: string;
}

/** Calls from the same number within this window belong to one enquiry (T17a + T17b). */
const SAME_ENQUIRY_DAYS = 7;
const DAY = 86_400_000;

export const effectiveStatus = (e: EnquiryRow): Status => e.override_status ?? e.status;

function costOf(u: TokenUsage, price?: PipelineDeps["geminiPriceInrPer1M"]): number | null {
  if (!price || price.input === null || price.output === null) return null;
  return (u.inputTokens * price.input + u.outputTokens * price.output) / 1_000_000;
}

export async function processCall(deps: PipelineDeps, incoming: IncomingCall, opts: { fixtureId?: string; force?: boolean } = {}): Promise<ProcessResult> {
  const { store } = deps;

  // 1–2. Save the raw call first, so nothing is lost if a later step fails.
  const { call } = await store.saveCall(incoming);
  const base = { callId: call.id, skipped: false, enquiryId: call.enquiry_id, ruleIds: [] as string[], flags: [] as string[] };
  if (call.processed_at && !opts.force) {
    const e = call.enquiry_id ? await store.getEnquiry(call.enquiry_id) : null;
    return { ...base, skipped: true, status: e ? effectiveStatus(e) : call.call_outcome === "completed" ? null : "missed", ruleIds: e?.rule_ids ?? [], flags: e?.flags ?? [] };
  }

  const related = call.caller_number && call.started_at
    ? await store.callsFromCaller(
        call.caller_number,
        new Date(Date.parse(call.started_at) - SAME_ENQUIRY_DAYS * DAY).toISOString(),
        new Date(Date.parse(call.started_at) + SAME_ENQUIRY_DAYS * DAY).toISOString(),
      )
    : [];
  const existingEnquiryId = related.find((c) => c.id !== call.id && c.enquiry_id)?.enquiry_id ?? null;

  // A missed or dropped call is not a completed enquiry: call row only (linked if the caller rang back).
  if (call.call_outcome !== "completed") {
    if (existingEnquiryId) await store.linkCall(call.id, existingEnquiryId);
    await store.markProcessed(call.id);
    await store.addAudit({ call_id: call.id, enquiry_id: existingEnquiryId, actor: "pipeline", action: `call_${call.call_outcome}` });
    return { ...base, enquiryId: existingEnquiryId, status: "missed" };
  }

  try {
    // All completed calls of this enquiry, oldest first, read as one conversation.
    const enquiryCalls = related.filter((c) => c.call_outcome === "completed" && (c.id === call.id || (existingEnquiryId && c.enquiry_id === existingEnquiryId)));
    const transcript: Turn[] = enquiryCalls.flatMap((c) => c.transcript);

    // 3. Extract (Gemini or fake). Invalid twice → needs_review, never a guess.
    let extraction: Extraction | null = null;
    let usage: TokenUsage[] = [];
    let extractError: string | null = null;
    try {
      const r = await deps.extractor.extract({ transcript, callDate: call.started_at, fixtureId: opts.fixtureId });
      extraction = r.extraction;
      usage = r.usage ?? [];
    } catch (err) {
      if (!(err instanceof ExtractionInvalidError)) throw err;
      usage = err.usage;
      extractError = err.message;
    }
    for (const u of usage)
      await store.addCostEvent({ call_id: call.id, kind: "gemini", model: u.model, input_tokens: u.inputTokens, output_tokens: u.outputTokens, cost_inr: costOf(u, deps.geminiPriceInrPer1M) });

    // 4–5. Locality, price scan, rules.
    const priceHits = scanAgentTurns(transcript);
    let enquiryData;
    let evaluations: RuleEvaluation[];
    if (extraction) {
      const locality = normaliseLocality(v(extraction, "locality") ?? v(extraction, "other_city"));
      const outcome = evaluate({ extraction, locality, priceHits, budgetFloorInr: deps.budgetFloorInr ?? null });
      enquiryData = {
        status: outcome.status, rule_ids: outcome.ruleIds, flags: outcome.flags, missing_fields: outcome.missingFields,
        fields: extraction as unknown as Record<string, unknown>, summary: extraction.summary || null,
        locality_raw: locality.raw, locality_normalised: locality.normalised, locality_confidence: locality.confidence,
        extractor: deps.extractor.name,
      };
      evaluations = outcome.evaluations;
    } else {
      enquiryData = {
        status: "needs_review" as Status, rule_ids: ["R-EXTRACT-01"], flags: priceHits.length ? ["price_figure_spoken"] : [],
        missing_fields: ["all fields (extraction failed)"], fields: {}, summary: null, extractor: deps.extractor.name,
      };
      evaluations = [{ ruleId: "R-EXTRACT-01", description: "AI extraction failed validation twice", fired: true, result: "needs_review" as Status, detail: extractError ?? "" }];
      await store.addPipelineError({ call_id: call.id, step: "extract", message: extractError ?? "extraction failed" });
    }

    // 6. Store.
    const enquiry = existingEnquiryId
      ? await store.updateEnquiry(existingEnquiryId, enquiryData)
      : await store.createEnquiry({ ...enquiryData, source: call.source, caller_number: call.caller_number });
    for (const c of related) if (!c.enquiry_id || c.id === call.id) await store.linkCall(c.id, enquiry.id);
    await store.replaceRuleEvaluations(enquiry.id, evaluations);
    await store.addAudit({ enquiry_id: enquiry.id, call_id: call.id, actor: "pipeline", action: "evaluated", detail: { status: enquiry.status, rules: enquiry.rule_ids, extractor: deps.extractor.name } });

    // 7. Outputs (HubSpot + emails), each at most once per enquiry.
    await runOutputs(deps, enquiry, call);

    await store.markProcessed(call.id);
    return { ...base, enquiryId: enquiry.id, status: effectiveStatus(enquiry), ruleIds: enquiry.rule_ids, flags: enquiry.flags };
  } catch (err) {
    // 8. Any unexpected failure: record it, alert the founder; the call stays unprocessed so sync retries it.
    const message = (err as Error).message;
    await store.addPipelineError({ call_id: call.id, step: "pipeline", message });
    if (deps.channels)
      await deliver(store, deps.channels, { kind: "system_alert", enquiryId: null, callId: call.id, subject: `[Aangan] Pipeline failed for call ${call.vaani_call_id}`, text: message });
    return { ...base, status: null, error: message };
  }
}

/** HubSpot + handoff for qualified; urgent email for escalation. Safe to call again (e.g. after an override). */
export async function runOutputs(deps: PipelineDeps, enquiry: EnquiryRow, call: CallRow | null): Promise<void> {
  const { store } = deps;
  const status = effectiveStatus(enquiry);
  if (!deps.channels) {
    await store.addAudit({ enquiry_id: enquiry.id, actor: "pipeline", action: "outputs_skipped_dry_run", detail: { status } });
    return;
  }
  const sent = await store.notificationsFor(enquiry.id);
  const already = (kind: string) => sent.some((n) => n.kind === kind && n.ok);
  const f = enquiry.fields as unknown as Extraction;
  const val = <K extends keyof Extraction>(k: K) => (f && (f[k] as { value?: unknown } | undefined)?.value) ?? null;
  const link = deps.dashboardUrl ? `${deps.dashboardUrl}/calls/${call?.id ?? ""}` : "(dashboard)";

  if (status === "qualified") {
    let hubspotLine = "HubSpot: not configured";
    if (deps.hubspot?.configured && !enquiry.hubspot_deal_id) {
      try {
        const lead = await deps.hubspot.createLead({
          name: val("caller_name") as string | null, phone: enquiry.caller_number, locality: enquiry.locality_normalised,
          propertyDetail: (val("property_detail") as string | null) ?? (val("bhk") ? `${val("bhk")}BHK` : null),
          summary: enquiry.summary, booked: enquiry.flags.includes("booked"),
          budgetMinInr: val("budget_min_inr") as number | null, budgetMaxInr: val("budget_max_inr") as number | null, enquiryId: enquiry.id,
        });
        enquiry = await store.updateEnquiry(enquiry.id, {
          hubspot_contact_id: lead.contactId, hubspot_deal_id: lead.dealId, hubspot_deal_url: lead.dealUrl,
          amount_inr: lead.amountInr, amount_source: lead.amountSource,
        });
        await store.addAudit({ enquiry_id: enquiry.id, actor: "pipeline", action: "hubspot_deal_created", detail: { dealId: lead.dealId, warnings: lead.warnings } });
        hubspotLine = `HubSpot deal: ${lead.dealUrl ?? lead.dealId}`;
      } catch (err) {
        await store.addPipelineError({ call_id: call?.id ?? null, step: "hubspot", message: (err as Error).message });
        await deliver(store, deps.channels, { kind: "system_alert", enquiryId: null, callId: call?.id ?? null, subject: `[Aangan] HubSpot failed for enquiry #${enquiry.id}`, text: (err as Error).message });
        hubspotLine = "HubSpot: FAILED (see dashboard)";
      }
    } else if (enquiry.hubspot_deal_id) hubspotLine = `HubSpot deal: ${enquiry.hubspot_deal_url ?? enquiry.hubspot_deal_id}`;

    if (!already("handoff")) {
      const ok = await deliver(store, deps.channels, {
        kind: "handoff", enquiryId: enquiry.id, callId: call?.id ?? null,
        subject: `[Aangan] Qualified lead: ${val("caller_name") ?? enquiry.caller_number ?? "caller"} — ${enquiry.locality_normalised ?? "area?"}`,
        text: [
          enquiry.summary ?? "",
          `Phone: ${enquiry.caller_number ?? "missing"}`,
          `Area: ${enquiry.locality_normalised ?? "missing"} · Property: ${val("property_detail") ?? val("property_type") ?? "missing"}`,
          `Timeline: ${val("timeline") ?? "missing"} · Booked in call: ${enquiry.flags.includes("booked") ? "yes" : "no"}`,
          `Flags: ${enquiry.flags.join(", ") || "none"}`,
          hubspotLine,
          `Details: ${link}`,
        ].join("\n"),
      });
      if (ok) await store.updateEnquiry(enquiry.id, { handoff_at: new Date().toISOString() });
    }
  }

  if (status === "escalation" && !already("escalation")) {
    await deliver(store, deps.channels, {
      kind: "escalation", enquiryId: enquiry.id, callId: call?.id ?? null,
      subject: `[Aangan] URGENT — existing client escalation (${val("caller_name") ?? enquiry.caller_number ?? "caller"})`,
      text: [
        enquiry.summary ?? "",
        `Phone: ${enquiry.caller_number ?? "missing"} · Area: ${enquiry.locality_normalised ?? "missing"}`,
        `Caller said: "${(f?.existing_client_complaint?.quote ?? f?.asks_for_senior?.quote) ?? "see transcript"}"`,
        "The agent promised no callback time. No HubSpot deal was created.",
        `Details: ${link}`,
      ].join("\n"),
    });
  }
}
