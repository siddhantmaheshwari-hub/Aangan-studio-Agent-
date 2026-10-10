// Numbers for the overview: this week vs last week, a 7-day chart, outcome mix, AI quality.
// Every figure is computed from stored rows; nothing is estimated except labelled costs.
import { getDb, type Row } from "./db";
import { env } from "./env";

const q = (text: string, params: unknown[] = []): Promise<Row[]> => {
  const url = env().databaseUrl;
  if (!url) throw new Error("DATABASE_URL is not set");
  return getDb(url).query(text, params);
};

const STATUS = `case when c.call_outcome <> 'completed' then 'missed' else coalesce(e.override_status, e.status) end`;
const T = `coalesce(c.started_at, c.created_at)`;
const src = (source: string, params: unknown[]) => (source === "all" ? "" : (params.push(source), `and c.source = $${params.length}`));

export interface Period {
  calls: number;
  completed: number;
  qualified: number;
  review: number;
  escalations: number;
  notFit: number;
  booked: number;
  seconds: number;
}

export interface WeekCompare {
  current: Period;
  previous: Period;
}

/** Last 7 days vs the 7 days before. */
export async function weekCompare(source: string): Promise<WeekCompare> {
  const params: unknown[] = [];
  const s = src(source, params);
  const block = (from: string, to: string, k: string) => `
    count(*) filter (where ${T} >= ${from} and ${T} < ${to})::int as ${k}calls,
    count(*) filter (where ${T} >= ${from} and ${T} < ${to} and c.call_outcome = 'completed')::int as ${k}completed,
    count(distinct e.id) filter (where ${T} >= ${from} and ${T} < ${to} and ${STATUS} = 'qualified')::int as ${k}qualified,
    count(distinct e.id) filter (where ${T} >= ${from} and ${T} < ${to} and ${STATUS} in ('needs_review','incomplete'))::int as ${k}review,
    count(distinct e.id) filter (where ${T} >= ${from} and ${T} < ${to} and ${STATUS} = 'escalation')::int as ${k}escalations,
    count(distinct e.id) filter (where ${T} >= ${from} and ${T} < ${to} and ${STATUS} = 'not_qualified')::int as ${k}notfit,
    count(distinct e.id) filter (where ${T} >= ${from} and ${T} < ${to} and 'booked' = any(e.flags))::int as ${k}booked,
    coalesce(sum(c.duration_sec) filter (where ${T} >= ${from} and ${T} < ${to}), 0)::int as ${k}seconds`;
  const [r] = await q(
    `select ${block("now() - interval '7 days'", "now()", "c_")}, ${block("now() - interval '14 days'", "now() - interval '7 days'", "p_")}
     from calls c left join enquiries e on e.id = c.enquiry_id where true ${s}`,
    params,
  );
  const mk = (k: string): Period => ({
    calls: Number(r[k + "calls"]), completed: Number(r[k + "completed"]), qualified: Number(r[k + "qualified"]), review: Number(r[k + "review"]),
    escalations: Number(r[k + "escalations"]), notFit: Number(r[k + "notfit"]), booked: Number(r[k + "booked"]), seconds: Number(r[k + "seconds"]),
  });
  return { current: mk("c_"), previous: mk("p_") };
}

export interface DayBucket {
  day: string; // YYYY-MM-DD (IST)
  label: string; // "Mon"
  qualified: number;
  review: number; // needs review + incomplete + escalation
  notFit: number;
  missed: number;
}

/** Calls per IST day for the last 7 days, split by outcome. */
export async function lastSevenDays(source: string): Promise<DayBucket[]> {
  const params: unknown[] = [];
  const s = src(source, params);
  const rows = await q(
    `with days as (
       select generate_series((now() at time zone 'Asia/Kolkata')::date - 6, (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as d
     )
     select to_char(d.d, 'YYYY-MM-DD') as day, to_char(d.d, 'Dy') as label,
            count(*) filter (where x.st = 'qualified')::int as qualified,
            count(*) filter (where x.st in ('needs_review','incomplete','escalation'))::int as review,
            count(*) filter (where x.st = 'not_qualified')::int as not_fit,
            count(*) filter (where x.st = 'missed')::int as missed
     from days d
     left join (
       select (${T} at time zone 'Asia/Kolkata')::date as d, ${STATUS} as st
       from calls c left join enquiries e on e.id = c.enquiry_id
       where ${T} >= now() - interval '8 days' and (c.processed_at is not null or c.call_outcome <> 'completed') ${s}
     ) x on x.d = d.d
     group by d.d order by d.d`,
    params,
  );
  return rows.map((r) => ({
    day: String(r.day), label: String(r.label), qualified: Number(r.qualified), review: Number(r.review), notFit: Number(r.not_fit), missed: Number(r.missed),
  }));
}

export interface Mix { status: string; count: number }

/** All-time outcome mix (one row per enquiry; missed calls counted per call). */
export async function outcomeMix(source: string): Promise<Mix[]> {
  const params: unknown[] = [];
  const s = src(source, params);
  const rows = await q(
    `select st as status, count(*)::int as count from (
       select distinct on (coalesce(e.id::text, 'call-' || c.id)) ${STATUS} as st
       from calls c left join enquiries e on e.id = c.enquiry_id
       where (c.processed_at is not null or c.call_outcome <> 'completed') ${s}
     ) x group by st`,
    params,
  );
  return rows.map((r) => ({ status: String(r.status), count: Number(r.count) }));
}

export interface AiQuality {
  enquiries: number;
  extractedOk: number; // enquiries the AI extracted without falling back to review
  priceIncidents: number; // agent spoke a price figure (guardrail: 0)
  overridden: number; // founder changed the rules' status
  deliveredPct: number | null; // handoff/escalation messages that reached someone
  medianHandoffMin: number | null;
}

export async function aiQuality(source: string): Promise<AiQuality> {
  const params: unknown[] = [];
  const s = source === "all" ? "" : (params.push(source), `and e.source = $1`);
  const [r] = await q(
    `with e as (select * from enquiries e where true ${s})
     select (select count(*) from e)::int as enquiries,
            (select count(*) from e where not ('R-EXTRACT-01' = any(rule_ids)))::int as extracted_ok,
            (select count(*) from e where 'price_figure_spoken' = any(flags))::int as price_incidents,
            (select count(*) from e where override_status is not null)::int as overridden,
            (select count(distinct n.enquiry_id) from notifications n where n.enquiry_id in (select id from e) and n.kind in ('handoff','escalation'))::int as attempted,
            (select count(distinct n.enquiry_id) from notifications n where n.enquiry_id in (select id from e) and n.kind in ('handoff','escalation') and n.ok)::int as delivered,
            (select percentile_cont(0.5) within group (order by extract(epoch from (e.handoff_at - (c.started_at + make_interval(secs => coalesce(c.duration_sec, 0))))) / 60)
               from e join calls c on c.enquiry_id = e.id and c.call_outcome = 'completed' where e.handoff_at is not null) as median_handoff`,
    params,
  );
  const attempted = Number(r.attempted);
  return {
    enquiries: Number(r.enquiries),
    extractedOk: Number(r.extracted_ok),
    priceIncidents: Number(r.price_incidents),
    overridden: Number(r.overridden),
    deliveredPct: attempted ? Math.round((Number(r.delivered) / attempted) * 100) : null,
    medianHandoffMin: r.median_handoff === null ? null : Number(Number(r.median_handoff).toFixed(1)),
  };
}
