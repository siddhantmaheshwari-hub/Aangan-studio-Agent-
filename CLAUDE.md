# Aangan Studio — Phone Enquiry Agent (MESA Case 03 · Vaani assignment, due Sat 10 Oct 2026, end of day)

Read this file fully at the start of every session. It is the source of truth for scope,
architecture and non-negotiable rules. If a request conflicts with it, say so before acting.

## What we are building
A Vaani voice agent answers every enquiry call to Aangan Studio (interior design, Pune), qualifies
the caller honestly, books a free consultation in the call when the caller is a fit, and after the
call our app on Vercel stores everything, pushes qualified leads to HubSpot and emails the team via Resend, alerts on
complaints, and shows every completed call — with recording and transcript — on a dashboard.

- Scope: phone enquiries only (tested via Vaani's "Start test" WebRTC call; no phone numbers are
  provided). WhatsApp and the web form are out of scope.
- Business context: ~200 enquiries/month, ~48% unanswered within 48h, ~33% after 10am–7pm,
  answered-within-1h converts 4x next-day, projects average ₹8–14 lakh, front desk of 2.

## How it is evaluated (build for this)
1. **Dashboard rows from real test calls** on the deployed Vercel app — every completed call,
   qualified or not, with transcript and playable recording. The evaluator cannot see emails or Telegram.
2. **GitHub repo** — integrations must be readable and real.
3. **Components map** with all six labels: Trigger, Input, Context, Processing, AI, Output.
Features that exist but don't work lose marks. If the app breaks, nothing after that point is
marked. Prefer fewer features that work end to end.

## The call is a closed bubble
During a call nothing from outside reaches Vaani — not this app, not Gemini. Everything the agent
needs lives in the Vaani dashboard: system prompt (`VAANI_SYSTEM_PROMPT.md`), FAQ, voice,
language, and the Cal.com booking action. Our app only acts after the call ends.

## Non-negotiable rules
1. **No price figures, ever.** Enforced in the Vaani prompt; verified after each call by the price
   scanner. `pricing.md` is never given to Vaani or Gemini.
2. **Final status is set by code.** Gemini extracts facts and suggests; `rules.ts` decides and
   records the rule IDs that fired.
3. **Complaints bypass sales** → status `escalation`, urgent email alert, never a HubSpot deal.
4. **Never auto-decline a borderline case** → `needs_review`.
5. **No false success.** A notification is "sent" only on a 2xx from the provider. A disconnected
   call is not a completed enquiry. Missing values are shown as missing.
6. **No fabricated numbers.** Every dashboard figure comes from stored rows. Estimates are labelled.
7. **Secrets** only in `.env.local` / Vercel env vars. Never in client components, logs, or Git.
   The Vaani key never reaches the browser: recordings are streamed through a server route.
   *Changed 10 Oct at the owner's explicit request:* the dashboard has **no password** — anyone with
   the link can view and use it. Machine routes (Vaani webhook, sync, health, cron) still need their secrets.
8. **Every feature on screen must work.** If something can't be finished today, remove it from
   the UI rather than leave it broken.

## Stack (one app, one deploy)
- **Next.js (App Router, TypeScript) on Vercel**: webhook/sync API routes, dashboard pages.
- **Neon** Postgres via `@neondatabase/serverless`; SQL migrations in `migrations/`.
- **Gemini** via `@google/genai` — cheapest Flash-tier model that passes the fixture tests;
  record model and token counts on every call.
- **Vaani** REST (`https://api.vaanivoice.ai`, header `X-API-Key`). Endpoints confirmed from the
  official SDK source: `/api/call-history`, `/api/call_details/{call_id}` (transcript, entities,
  evaluation, summary), `/api/transcript/{call_id}`, `/api/stream/{call_id}` (recording),
  `/api/health`. Post-call delivery: use Vaani's post-call webhook if the dashboard offers one
  (the course says "the transcript is sent to your app"); otherwise poll call history.
- **HubSpot** (private app token): qualified lead → contact + deal in an "Aangan Enquiries"
  pipeline. The founder needs a pipeline view to forecast revenue; Neon alone can't give that.
- **Resend (primary channel)**: qualified-lead handoff email to the team, urgent escalation email,
  system-failure alerts and a daily digest to the founder. Without a verified domain Resend may only
  send to the account owner's own address — verify. If so, all emails go to the founder's address
  for now and the UI says so.
- **Telegram (second channel, optional)** — *changed 10 Oct 2026 at the user's request*: with
  `TELEGRAM_MODE=always` (default) every handoff, escalation, alert and digest goes to **both**
  Resend and the team's Telegram chat; delivered = either channel returned 2xx, and each channel's
  result is recorded and shown separately. `TELEGRAM_MODE=fallback` restores the original rule
  (Telegram only after Resend fails twice). No bot token or chat id = email only.
- **Cal.com**: connected inside Vaani (Actions → Integrations → Booking appointment). Booking
  happens during the call, for FIT callers only. Our app reads booking status from the call
  details/transcript; it does not call Cal.com itself unless needed.
- **Scheduler**: see "Vercel (Hobby plan)" below.

## Vercel (Hobby plan — confirmed on the user's account)
- **Cron is once per day only**, fires anywhere within the scheduled hour, UTC, production only.
  Any expression that runs more often FAILS THE DEPLOY. So:
  - Vercel cron: only the founder's daily digest (e.g. `30 2 * * *` = 8:00 AM IST).
  - Post-call data: Vaani webhook (preferred). Fallback polling and the health ping run from a
    GitHub Actions `schedule` workflow (every 10–15 min) calling `/api/sync` and `/api/health`
    with `Authorization: Bearer $CRON_SECRET`. Vercel does not retry failed cron runs.
- **Function duration**: set `maxDuration` explicitly on `/api/vaani/webhook` and `/api/sync`
  and check the Hobby ceiling in the docs. Process one call per invocation; save the raw call
  first, so a timeout never loses data and the next sync retries the rest.
- **Region**: this project's Neon database is in AWS us-east-1, so set the Vercel function region
  to `iad1` (Washington, D.C.) to keep database calls fast.
- **Webhook URL**: use the production domain. Preview deployments may sit behind Deployment
  Protection and reject Vaani's request; crons also run only on production.
- **Env vars**: add every key in Vercel → Settings → Environment Variables (Production, and
  Preview if you test there). Redeploy after changing them.
- **Recordings**: stream the audio from Vaani through the route; don't buffer whole files in
  memory.
- Deploys happen automatically on every push to the GitHub production branch.

## After-call pipeline (idempotent by Vaani call_id)
1. Receive webhook or poll → fetch details, transcript, duration, status, recording reference.
2. Save the raw call to `calls` (even if later steps fail).
3. Gemini: extract fields to a fixed JSON schema, quoting the caller's words per field, plus a
   2-line summary. Validate with zod; one retry; else `needs_review`.
4. Normalise locality with an alias table + fuzzy match (Hinjawadi→Hinjewadi,
   Pimpri Chinchwad→PCMC, Koregaon→Koregaon Park). Low-confidence match → `needs_review`.
5. Rules engine → status + rule IDs + flags. Price scanner on AGENT turns.
6. Write `enquiries`, `rule_evaluations`, `cost_events`, `audit_log`.
7. Qualified → HubSpot contact + deal, handoff email (Resend). Escalation → urgent email (Resend).
   Resend retries once; Telegram is sent alongside (or as fallback, per TELEGRAM_MODE). Record every attempt (channel,
   result, provider id) in `notifications`.
8. Any step failing → `pipeline_errors` row + Resend alert to the founder.

## HubSpot deal (forecasting without quoting)
Stages: New enquiry → Consultation booked → Site visit → Proposal sent → Won / Lost.
Deal amount: caller-volunteered budget midpoint if given, else ₹11,00,000 (midpoint of the
case's ₹8–14 lakh average), with property `amount_source` = `caller_budget` | `studio_average`.
Internal forecasting only; never said to a caller.

## Statuses (precedence high → low)
`escalation` > `missed` > `not_qualified` > `needs_review` > `incomplete` > `qualified`.
Flags: `price_asked`, `price_figure_spoken` (agent said a number — critical), `budget_volunteered`,
`referral`, `tenant`, `caller_not_decision_maker`, `prior_contact_frustrated`, `timeline_reoffer`,
`booked`, `priority`.

## Rules (source of truth: docs/rules/qualified.md + docs/rules/services.md, received 10 Oct)
These replaced the PROXY rules. Code: `lib/rules.ts`. pricing.md stays outside the repo prompts:
only its lowest rates live in `lib/budgetCheck.ts`, used by code, never sent to Vaani/Gemini or shown.
| ID | Rule | Result | Source |
|---|---|---|---|
| R-ESC-01 | Existing project complaint, or demands Nikhil/a senior person | escalation | CLAUDE.md |
| R-AREA-01 | Outside Pune city/PCMC (Talegaon, Lonavala, Nashik, Mumbai…) | not_qualified | services.md |
| R-AREA-02 | Locality not recognised | needs_review | — |
| R-SCOPE-01 | Advice/decor only, furniture sourcing only, Vastu only, structural work | not_qualified | qualified §1, services |
| R-SCOPE-02 | Structural changes inside a project | needs_review | services.md |
| R-TYPE-01 | Restaurant, hotel, retail store, gym | not_qualified | services.md |
| R-TYPE-02 | Other type | needs_review | — |
| R-SIZE-01 | Commercial under 500 sq ft (no minimum in services.md) | needs_review | — |
| R-SIZE-02 | Commercial over ~3,000 sq ft | needs_review | services.md |
| R-TIME-01 | Must be ready in under 6 weeks, later finish declined | not_qualified | services.md |
| R-TIME-02 | Site not available for execution within 10 weeks | needs_review | qualified §3 |
| R-BUDGET-01 | Volunteered budget < half the internal minimum for the scope | not_qualified | qualified §4 |
| R-BUDGET-02 | Volunteered budget below the internal minimum | needs_review | qualified §4 |
| R-DM-01 | Caller not the decider and the decider not involved | needs_review | qualified §5 |
| R-PRICE-01 | Agent spoke a price figure | needs_review | pricing.md |
| R-COMPLETE-01 | Missing location or project type | incomplete | — |
No budget mentioned → qualified (never probe). Scope too vague to judge a budget → qualified + noted.
In-area (services.md): Kothrud, Baner, Aundh, Wakad, Koregaon Park, Kalyani Nagar, Viman Nagar,
Hadapsar, Magarpatta, NIBM, Kondhwa, Undri, Shivane, Warje, Erandwane, Deccan and adjoining Pune areas
(incl. Kharadi, Nanded City); PCMC: Pimpri, Chinchwad, Pimple Saudagar, Pimple Nilakh, Ravet, Hinjewadi.
Renting never disqualifies (unless structural changes are needed).

## Dashboard (must work end to end)
- No login (owner's decision, 10 Oct): open to anyone with the link.
- Calls table: time, duration, caller, status badge, flags, rule IDs, booking, HubSpot link,
  Email and Telegram sent/failed, shown separately. Filters: status, date range, flag. "Clear filters" resets everything.
- Call detail: summary, extracted fields with the caller's quotes, transcript, recording player,
  "why this status" (rules fired), notification history, manual status override with reason
  (the founder makes the final call on review items).
- Overview: calls, completed, qualified, needs review, escalations, bookings, delivery failures,
  median time from call end to handoff, cost (Vaani minutes × ₹5.5 course rate, labelled
  estimate; Gemini tokens × configured price).
- Health strip: last successful sync, Neon OK, Vaani `/api/health` OK.
- Empty, loading and error states. No placeholder numbers.

## Tests before spending call minutes (₹100 ≈ 15–18 min)
Run the pipeline on `fixtures/phone_transcripts.json` (T01–T20, T17 split) with a fake extractor,
then with Gemini. Expected results:
| Fixture | Expected |
|---|---|
| T01, T05, T06, T12, T15, T20 | qualified (T01, T05 `referral`; T12 `priority`) |
| T02, T13 | qualified + `price_asked` |
| T03 | not_qualified R-AREA-01 · T04 not_qualified R-SCOPE-01 |
| T07 | not_qualified R-TIME-01 + `timeline_reoffer` |
| T08 | missed; call row only |
| T09 | escalation R-ESC-01; urgent email; no HubSpot deal |
| Synthetic | Resend returns an error → one retry → Telegram fallback if configured; both recorded. Both fail → `pipeline_errors` row and dashboard shows "not delivered" |
| T10 | not_qualified R-BUDGET-01 + `budget_volunteered` (₹1–1.5 lakh for 2 rooms is clearly below — qualified.md §4) |
| T11 | qualified + `tenant` · T14 qualified + `caller_not_decision_maker` |
| T16 | qualified + `prior_contact_frustrated` |
| T17a + T17b | one enquiry, two calls; T17a disconnected |
| T18 | needs_review R-SIZE-01 (no minimum in services.md) · T19 not_qualified R-TYPE-01 |
| Synthetic | AGENT says "₹1,800 per sq ft" → `price_figure_spoken` + review |
| Synthetic | "Hinjawadi" → normalised to Hinjewadi → qualified (PCMC, services.md) |
| S03–S06 | Phone versions of web forms F03 (Talegaon → not_qualified R-AREA-01), F05 (office → qualified), F08 (3 weeks → not_qualified R-TIME-01), F06 (site free Feb 2027 → needs_review R-TIME-02) |
| All | replay twice → no duplicates; every Gemini call writes a cost_event |
Then live test calls per `TEST_CALLS.md`. Report pass/fail honestly; list anything mocked.

## Working style
- The user is learning. Explain each decision in plain language, briefly.
- Plan before code; wait for the user's OK on the plan.
- Small commits; push after every working step (the deploy pulls from GitHub).
- Never claim something works without running it.
