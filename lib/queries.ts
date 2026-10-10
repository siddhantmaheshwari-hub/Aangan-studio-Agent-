// Read-only queries for the dashboard. Every number shown comes from stored rows.
import { getDb, type Row } from "./db";
import { env } from "./env";

const q = (text: string, params: unknown[] = []): Promise<Row[]> => {
  const url = env().databaseUrl;
  if (!url) throw new Error("DATABASE_URL is not set");
  return getDb(url).query(text, params);
};

export interface Filters {
  status?: string;
  flag?: string;
  from?: string;
  to?: string;
  source?: string; // live | replay | all
}

// Status of a call row: missed/dropped calls are "missed"; otherwise the enquiry's (overridden) status.
const STATUS_EXPR = `case when c.call_outcome <> 'completed' then 'missed' else coalesce(e.override_status, e.status) end`;
const CALL_TIME = `coalesce(c.started_at, c.created_at)`;

function where(f: Filters, params: unknown[]) {
  const w: string[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.source && f.source !== "all") w.push(`c.source = ${p(f.source)}`);
  if (f.status) w.push(`${STATUS_EXPR} = ${p(f.status)}`);
  if (f.flag) w.push(`${p(f.flag)} = any(e.flags)`);
  if (f.from) w.push(`${CALL_TIME} >= ${p(f.from)}`);
  if (f.to) w.push(`${CALL_TIME} < (${p(f.to)}::date + interval '1 day')`);
  return w.length ? `where ${w.join(" and ")}` : "";
}

export interface CallListRow {
  id: number;
  started_at: string | null;
  duration_sec: number | null;
  caller_number: string | null;
  caller_name: string | null;
  source: string;
  call_outcome: string;
  status: string | null;
  flags: string[];
  rule_ids: string[];
  hubspot_deal_url: string | null;
  hubspot_deal_id: string | null;
  email: "sent" | "failed" | null;
  telegram: "sent" | "failed" | null;
  processed: boolean;
  enquiry_id: number | null;
  attempts: number;
  summary: string | null;
  area: string | null;
}

export async function listCalls(f: Filters): Promise<CallListRow[]> {
  const params: unknown[] = [];
  const rows = await q(
    `select c.id, ${CALL_TIME} as started_at, c.duration_sec, c.caller_number, c.source, c.call_outcome, c.enquiry_id, c.attempts,
            e.summary, e.locality_normalised as area,
            c.processed_at is not null as processed, ${STATUS_EXPR} as status,
            coalesce(e.flags, '{}') as flags, coalesce(e.rule_ids, '{}') as rule_ids,
            e.hubspot_deal_url, e.hubspot_deal_id, e.fields->'caller_name'->>'value' as caller_name,
            (select case when bool_or(n.ok and n.channel = 'resend') then 'sent'
                         when count(*) filter (where n.channel = 'resend') > 0 then 'failed' end
               from notifications n where n.enquiry_id = e.id and n.kind in ('handoff','escalation')) as email,
            (select case when bool_or(n.ok and n.channel = 'telegram') then 'sent'
                         when count(*) filter (where n.channel = 'telegram') > 0 then 'failed' end
               from notifications n where n.enquiry_id = e.id and n.kind in ('handoff','escalation')) as telegram
       from calls c left join enquiries e on e.id = c.enquiry_id
       ${where(f, params)}
       order by ${CALL_TIME} desc limit 500`,
    params,
  );
  return rows.map((r) => ({
    ...(r as unknown as CallListRow),
    id: Number(r.id),
    enquiry_id: r.enquiry_id === null ? null : Number(r.enquiry_id),
    started_at: r.started_at instanceof Date ? r.started_at.toISOString() : (r.started_at as string | null),
  }));
}

export async function getCallDetail(id: number) {
  const [call] = await q(`select * from calls where id = $1`, [id]);
  if (!call) return null;
  const enquiryId = call.enquiry_id as number | null;
  const [enquiry] = enquiryId ? await q(`select * from enquiries where id = $1`, [enquiryId]) : [];
  const [rules, notifications, siblings, errors, audit] = await Promise.all([
    enquiryId ? q(`select rule_id, fired, result, detail from rule_evaluations where enquiry_id = $1 order by fired desc, rule_id`, [enquiryId]) : [],
    enquiryId ? q(`select * from notifications where enquiry_id = $1 order by created_at, id`, [enquiryId]) : [],
    enquiryId ? q(`select id, ${CALL_TIME.replace(/c\./g, "")} as started_at, call_outcome, duration_sec from calls where enquiry_id = $1 and id <> $2 order by started_at`, [enquiryId, id]) : [],
    q(`select step, message, created_at from pipeline_errors where call_id = $1 order by created_at desc limit 20`, [id]),
    enquiryId ? q(`select actor, action, detail, created_at from audit_log where enquiry_id = $1 order by created_at desc limit 20`, [enquiryId]) : [],
  ]);
  return { call, enquiry: enquiry ?? null, rules, notifications, siblings, errors, audit };
}

export interface Overview {
  calls: number;
  completed: number;
  missed: number;
  qualified: number;
  needsReview: number;
  escalations: number;
  booked: number;
  deliveryFailures: number;
  medianHandoffMin: number | null;
  vaaniMinutes: number;
  vaaniCostInr: number | null;
  geminiTokens: number;
  geminiCostInr: number | null;
  geminiCalls: number;
  geminiUnpriced: number;
  pipelineErrors: number;
}

export async function overview(f: Filters): Promise<Overview> {
  const params: unknown[] = [];
  const w = where(f, params);
  const [r] = await q(
    `with base as (
       select c.*, ${STATUS_EXPR} as st, e.flags, e.handoff_at, e.id as eid
       from calls c left join enquiries e on e.id = c.enquiry_id ${w}
     )
     select count(*)::int as calls,
            count(*) filter (where call_outcome = 'completed')::int as completed,
            count(*) filter (where call_outcome <> 'completed')::int as missed,
            count(distinct eid) filter (where st = 'qualified')::int as qualified,
            count(distinct eid) filter (where st = 'needs_review')::int as needs_review,
            count(distinct eid) filter (where st = 'escalation')::int as escalations,
            count(distinct eid) filter (where 'booked' = any(flags))::int as booked,
            coalesce(sum(duration_sec) filter (where source = 'live'), 0)::int as seconds,
            (select percentile_cont(0.5) within group (order by extract(epoch from (b.handoff_at - (b.started_at + make_interval(secs => coalesce(b.duration_sec, 0))))) / 60)
               from base b where b.handoff_at is not null and b.call_outcome = 'completed') as median_handoff_min,
            (select count(distinct n.enquiry_id)::int from notifications n where n.enquiry_id in (select eid from base)
               and n.kind in ('handoff','escalation')
               and not exists (select 1 from notifications n2 where n2.enquiry_id = n.enquiry_id and n2.kind = n.kind and n2.ok)) as delivery_failures,
            (select coalesce(sum(input_tokens + output_tokens), 0)::int from cost_events ce where ce.call_id in (select id from base)) as gemini_tokens,
            (select sum(cost_inr)::float from cost_events ce where ce.call_id in (select id from base)) as gemini_cost,
            (select count(*)::int from cost_events ce where ce.call_id in (select id from base)) as gemini_calls,
            (select count(*)::int from cost_events ce where ce.call_id in (select id from base) and cost_inr is null) as gemini_unpriced,
            (select count(*)::int from pipeline_errors pe where pe.call_id in (select id from base)) as pipeline_errors
     from base`,
    params,
  );
  const rate = env().vaaniCostPerMinInr;
  const minutes = Number(r.seconds) / 60;
  const geminiCalls = Number(r.gemini_calls);
  const unpriced = Number(r.gemini_unpriced);
  return {
    calls: Number(r.calls),
    completed: Number(r.completed),
    missed: Number(r.missed),
    qualified: Number(r.qualified),
    needsReview: Number(r.needs_review),
    escalations: Number(r.escalations),
    booked: Number(r.booked),
    deliveryFailures: Number(r.delivery_failures),
    medianHandoffMin: r.median_handoff_min === null ? null : Number(Number(r.median_handoff_min).toFixed(1)),
    vaaniMinutes: Number(minutes.toFixed(1)),
    vaaniCostInr: rate === null ? null : Number((minutes * rate).toFixed(2)),
    geminiTokens: Number(r.gemini_tokens),
    geminiCostInr: geminiCalls === 0 ? 0 : unpriced === 0 ? Number(Number(r.gemini_cost).toFixed(4)) : null,
    geminiCalls,
    geminiUnpriced: unpriced,
    pipelineErrors: Number(r.pipeline_errors),
  };
}

export interface QueueItem {
  kind: "escalation" | "needs_review" | "incomplete" | "not_delivered" | "stuck";
  callId: number;
  name: string | null;
  phone: string | null;
  area: string | null;
  summary: string | null;
  ruleIds: string[];
  flags: string[];
  at: string | null;
  detail: string | null;
}

/** What needs a person, most urgent first. This is the founder's review gate. */
export async function actionQueue(source = "live"): Promise<QueueItem[]> {
  const params: unknown[] = [];
  const src = source === "all" ? "" : (params.push(source), `and e.source = $${params.length}`);
  const csrc = source === "all" ? "" : `and c.source = $1`;
  const [enquiries, stuck] = await Promise.all([
    q(
      `with x as (
         select e.*, coalesce(e.override_status, e.status) as st,
                (select max(c.id) from calls c where c.enquiry_id = e.id and c.call_outcome = 'completed') as call_id,
                exists (select 1 from notifications n where n.enquiry_id = e.id and n.kind in ('handoff','escalation') and n.ok) as delivered,
                exists (select 1 from notifications n where n.enquiry_id = e.id and n.kind in ('handoff','escalation')) as attempted
         from enquiries e where true ${src}
       )
       select *, case
           when attempted and not delivered and st in ('qualified','escalation') then 'not_delivered'
           when st = 'escalation' then 'escalation'
           else st end as kind
       from x
       where (attempted and not delivered and st in ('qualified','escalation'))
          or (st = 'escalation' and created_at > now() - interval '3 days')
          or (override_status is null and status in ('needs_review','incomplete'))
       order by case when st = 'escalation' then 0 when attempted and not delivered then 1 when st = 'needs_review' then 2 else 3 end,
                created_at desc
       limit 50`,
      params,
    ),
    q(
      `select c.id, c.caller_number, c.attempts, coalesce(c.started_at, c.created_at) as at,
              (select message from pipeline_errors pe where pe.call_id = c.id order by created_at desc limit 1) as err
       from calls c where c.processed_at is null and c.attempts > 0 ${csrc}
       order by c.created_at desc limit 20`,
      source === "all" ? [] : [source],
    ),
  ]);
  return [
    ...stuck.map((r) => ({
      kind: "stuck" as const, callId: Number(r.id), name: null, phone: r.caller_number as string | null, area: null, summary: null,
      ruleIds: [], flags: [], at: iso(r.at), detail: `Processing failed ${r.attempts}× — ${String(r.err ?? "").slice(0, 160)}`,
    })),
    ...enquiries.filter((r) => r.call_id !== null).map((r) => {
      const f = r.fields as Record<string, { value?: unknown }> | null;
      return {
        kind: r.kind as QueueItem["kind"], callId: Number(r.call_id), name: (f?.caller_name?.value as string) ?? null,
        phone: r.caller_number as string | null, area: r.locality_normalised as string | null, summary: r.summary as string | null,
        ruleIds: r.rule_ids as string[], flags: r.flags as string[], at: iso(r.created_at), detail: null,
      };
    }),
  ];
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : (d as string | null));

export async function recentErrors(limit = 5) {
  return q(`select pe.step, pe.message, pe.created_at, pe.call_id from pipeline_errors pe order by created_at desc limit $1`, [limit]);
}
