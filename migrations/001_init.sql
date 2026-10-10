-- Aangan enquiry agent — initial schema (Neon Postgres).
-- Idempotent: safe to run more than once.

-- One row per Vaani call (or fixture replay). Saved FIRST, before any processing.
create table if not exists calls (
  id               bigserial primary key,
  vaani_call_id    text not null unique,
  source           text not null default 'live',          -- live | replay
  caller_number    text,
  started_at       timestamptz,
  duration_sec     integer,
  call_outcome     text not null default 'unknown',       -- completed | missed | disconnected | unknown
  transcript       jsonb not null default '[]'::jsonb,    -- [["AGENT"|"USER", text], ...]
  summary_vaani    text,
  raw              jsonb,                                  -- untouched provider payload
  enquiry_id       bigint,
  processed_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists calls_caller_idx on calls (caller_number, started_at desc);
create index if not exists calls_started_idx on calls (started_at desc);

-- One row per enquiry. A caller who rings back (T17a + T17b) shares one enquiry.
create table if not exists enquiries (
  id                   bigserial primary key,
  source               text not null default 'live',
  caller_number        text,
  status               text not null,                     -- set by rules.ts only
  rule_ids             text[] not null default '{}',
  flags                text[] not null default '{}',
  missing_fields       text[] not null default '{}',
  fields               jsonb not null default '{}'::jsonb, -- extracted {value, quote} per field
  summary              text,
  locality_raw         text,
  locality_normalised  text,
  locality_confidence  real,
  extractor            text,                               -- fake | gemini:<model>
  override_status      text,
  override_reason      text,
  overridden_at        timestamptz,
  hubspot_contact_id   text,
  hubspot_deal_id      text,
  hubspot_deal_url     text,
  amount_inr           bigint,
  amount_source        text,                               -- caller_budget | studio_average
  handoff_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

do $$ begin
  alter table calls add constraint calls_enquiry_fk foreign key (enquiry_id) references enquiries(id);
exception when duplicate_object then null; end $$;

-- Every rule checked for an enquiry, fired or not ("why this status").
create table if not exists rule_evaluations (
  id           bigserial primary key,
  enquiry_id   bigint not null references enquiries(id) on delete cascade,
  rule_id      text not null,
  fired        boolean not null,
  result       text,
  detail       text,
  created_at   timestamptz not null default now()
);
create index if not exists rule_eval_enquiry_idx on rule_evaluations (enquiry_id);

-- Every delivery attempt. ok = true only on a 2xx from the provider.
create table if not exists notifications (
  id            bigserial primary key,
  enquiry_id    bigint references enquiries(id) on delete cascade,
  kind          text not null,      -- handoff | escalation | system_alert | digest
  channel       text not null,      -- resend | telegram
  attempt       integer not null,
  ok            boolean not null,
  provider_id   text,
  recipient     text,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists notifications_enquiry_idx on notifications (enquiry_id);

create table if not exists cost_events (
  id             bigserial primary key,
  call_id        bigint references calls(id) on delete cascade,
  kind           text not null,    -- gemini
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  cost_inr       numeric,          -- null when the price is not configured
  created_at     timestamptz not null default now()
);

create table if not exists pipeline_errors (
  id          bigserial primary key,
  call_id     bigint references calls(id) on delete cascade,
  step        text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);

create table if not exists audit_log (
  id          bigserial primary key,
  enquiry_id  bigint references enquiries(id) on delete cascade,
  call_id     bigint references calls(id) on delete cascade,
  actor       text not null,       -- pipeline | founder | system
  action      text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- Small key/value table: last successful sync, last health alert, etc.
create table if not exists sync_state (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);
