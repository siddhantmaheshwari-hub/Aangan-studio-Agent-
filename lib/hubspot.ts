// HubSpot: qualified lead → contact + deal in the "Aangan Enquiries" pipeline.
// Deal amount is for the founder's internal forecast only — never said to a caller.

export const STUDIO_AVERAGE_INR = 1_100_000; // midpoint of the case's ₹8–14 lakh average

export interface LeadInput {
  name: string | null;
  phone: string | null;
  locality: string | null;
  propertyDetail: string | null;
  summary: string | null;
  booked: boolean;
  budgetMinInr: number | null;
  budgetMaxInr: number | null;
  enquiryId: number;
}

export interface LeadResult {
  contactId: string;
  dealId: string;
  dealUrl: string | null;
  amountInr: number;
  amountSource: "caller_budget" | "studio_average";
  warnings: string[];
}

export interface HubSpotClient {
  configured: boolean;
  createLead(lead: LeadInput): Promise<LeadResult>;
}

export function dealAmount(min: number | null, max: number | null): { amount: number; source: LeadResult["amountSource"] } {
  if (min !== null && max !== null) return { amount: Math.round((min + max) / 2), source: "caller_budget" };
  if (min !== null || max !== null) return { amount: (min ?? max)!, source: "caller_budget" };
  return { amount: STUDIO_AVERAGE_INR, source: "studio_average" };
}

const BASE = "https://api.hubapi.com";

export function hubspotClient(token: string | undefined, pipelineId: string | undefined): HubSpotClient {
  let stageCache: Record<string, string> | null = null;
  let portalId: string | null = null;
  let uiDomain = "app.hubspot.com";

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HubSpot ${init.method ?? "GET"} ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** Stage IDs by lower-cased label, e.g. "new enquiry" → "123456". */
  async function stages() {
    if (stageCache) return stageCache;
    const p = await call<{ stages: { id: string; label: string }[] }>(`/crm/v3/pipelines/deals/${pipelineId}`);
    stageCache = Object.fromEntries(p.stages.map((s) => [s.label.trim().toLowerCase(), s.id]));
    return stageCache;
  }

  async function portal() {
    if (portalId) return portalId;
    try {
      const a = await call<{ portalId: number; uiDomain?: string }>(`/account-info/v3/details`);
      portalId = String(a.portalId);
      if (a.uiDomain) uiDomain = a.uiDomain; // e.g. app-na2.hubspot.com for EU/NA2 accounts
    } catch {
      portalId = null;
    }
    return portalId;
  }

  async function findOrCreateContact(lead: LeadInput): Promise<string> {
    if (lead.phone) {
      const found = await call<{ results: { id: string }[] }>(`/crm/v3/objects/contacts/search`, {
        method: "POST",
        body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: lead.phone }] }], limit: 1 }),
      });
      if (found.results[0]) return found.results[0].id;
    }
    const [first, ...rest] = (lead.name ?? "Unknown caller").split(" ");
    const c = await call<{ id: string }>(`/crm/v3/objects/contacts`, {
      method: "POST",
      body: JSON.stringify({ properties: { firstname: first, lastname: rest.join(" ") || undefined, phone: lead.phone ?? undefined } }),
    });
    return c.id;
  }

  return {
    configured: Boolean(token && pipelineId),
    async createLead(lead) {
      if (!token || !pipelineId) throw new Error("HubSpot not configured (HUBSPOT_TOKEN / HUBSPOT_PIPELINE_ID)");
      const warnings: string[] = [];
      const st = await stages();
      const stageLabel = lead.booked ? "consultation booked" : "new enquiry";
      const stageId = st[stageLabel];
      if (!stageId) throw new Error(`HubSpot pipeline has no stage named "${stageLabel}". Stages: ${Object.keys(st).join(", ")}`);

      const contactId = await findOrCreateContact(lead);
      const { amount, source } = dealAmount(lead.budgetMinInr, lead.budgetMaxInr);
      const properties: Record<string, string> = {
        dealname: `${lead.name ?? "Caller"} — ${lead.propertyDetail ?? "project"}${lead.locality ? `, ${lead.locality}` : ""}`,
        pipeline: pipelineId,
        dealstage: stageId,
        amount: String(amount),
        amount_source: source,
        description: `${lead.summary ?? ""}\n\nAangan enquiry #${lead.enquiryId}. Amount is an internal estimate (${source}).`,
      };
      const body = (props: Record<string, string>) =>
        JSON.stringify({
          properties: props,
          associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
        });

      let deal: { id: string };
      try {
        deal = await call(`/crm/v3/objects/deals`, { method: "POST", body: body(properties) });
      } catch (err) {
        // The custom amount_source property may not exist yet; keep the source in the description instead.
        if (!/amount_source|PROPERTY_DOESNT_EXIST/i.test((err as Error).message)) throw err;
        const { amount_source: _drop, ...rest } = properties;
        deal = await call(`/crm/v3/objects/deals`, { method: "POST", body: body(rest) });
        warnings.push("Deal property amount_source does not exist in HubSpot; recorded in the description instead.");
      }
      const pid = await portal();
      return {
        contactId, dealId: deal.id, amountInr: amount, amountSource: source, warnings,
        dealUrl: pid ? `https://${uiDomain}/contacts/${pid}/record/0-3/${deal.id}` : null,
      };
    },
  };
}
