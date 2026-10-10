-- Processing lease: stops the webhook and /api/sync from processing the same call twice at once,
-- and caps retries so a broken call doesn't alert the founder every 15 minutes forever.
alter table calls add column if not exists attempts integer not null default 0;
alter table calls add column if not exists processing_started_at timestamptz;
