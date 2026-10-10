# Aangan Studio — phone enquiry agent

A Vaani voice agent answers enquiry calls. After each call this app (Next.js on Vercel) stores the
call, extracts facts with Gemini, decides the status **in code** (`lib/rules.ts`), pushes qualified
leads to HubSpot, emails the team via Resend, and shows every call on a dashboard with transcript
and recording.

## Components map

| Label | What | Where |
|---|---|---|
| **Trigger** | Call ends → Vaani post-call webhook; fallback: GitHub Actions every 15 min calls `/api/sync` | `app/api/vaani/webhook`, `app/api/sync`, `.github/workflows/sync.yml` |
| **Input** | Call details, transcript, duration, recording from Vaani REST | `lib/vaani.ts` |
| **Context** | In-area locality list + aliases, PROXY qualification rules, earlier calls from the same number (one enquiry) | `lib/locality.ts`, `lib/rules.ts`, `lib/pipeline.ts` |
| **Processing** | Save raw call → extract → normalise locality → price scanner on AGENT turns → rules engine → Neon | `lib/pipeline.ts`, `lib/priceScanner.ts`, `migrations/` |
| **AI** | Vaani (the call itself, closed bubble). Gemini extracts fields + caller quotes + 2-line summary to a zod-validated schema; it never decides the status | `lib/extract/gemini.ts`, `lib/extract/schema.ts` |
| **Output** | Dashboard; HubSpot contact + deal (qualified only); Resend handoff / urgent escalation / failure alerts / daily digest; Telegram to the team chat (alongside email) | `app/(dash)`, `lib/hubspot.ts`, `lib/notify.ts`, `app/api/cron/digest` |

## Statuses (code decides, precedence high → low)
`escalation` > `missed` > `not_qualified` > `needs_review` > `incomplete` > `qualified`.
Every rule is evaluated and stored (`rule_evaluations`), so the call page shows "why this status".
Rules are **PROXY** until Nikhil's qualified.md / services.md arrive.

Deviation from CLAUDE.md, made so the expected fixture results hold: **R-COMPLETE-01** fires only
when *location or project type* is missing. T11, T13, T14 and T16 are expected `qualified` without
a stated timeline/scope, so missing scope/timeline is shown as "missing" on the dashboard instead
of blocking qualification.

UX plan, Nine Checks, components map, call flow and the UX scorecard: [docs/UX_PLAN.md](docs/UX_PLAN.md).

## Run locally
```bash
npm install
npm test                      # unit + pipeline tests (no keys needed)
npm run replay                # fixture table, fake extractor, in memory
npm run replay -- --gemini    # same with Gemini + field-accuracy grade (needs GEMINI_API_KEY)
EXTRACT_DEBUG=1 npm run replay -- --gemini   # also print why any model answer was rejected
npm run migrate               # create tables in Neon (needs DATABASE_URL)
npm run replay -- --db        # write fixture replays to Neon (shown as "fixture replay")
npm run replay -- --db --send --only T01,T09   # test HubSpot + Resend for real
npm run dev

# Local database instead of Neon (no account needed):
npm run db:local              # terminal 1: Postgres-compatible server on :54329 (data in .localdb/)
npm run migrate:local         # terminal 2: create tables
npm run replay:local          # load the fixture calls
npm run dev:local             # dashboard on http://localhost:3002

# Telegram (sent alongside email; TELEGRAM_MODE=fallback to use it only when email fails): message @AanganEcho_bot (or add it to the team group), then
npm run telegram:setup -- --test   # saves TELEGRAM_CHAT_ID to .env.local and sends one test message
```

With `--gemini`, the replay also grades Gemini's extraction field by field against the hand-labelled
fixtures (`lib/eval.ts`) — run it after every prompt or model change.

## Deploy (Vercel Hobby)
- Region `iad1` (Neon is in us-east-1), daily digest cron only (Hobby allows once a day).
- Add every key from `.env.example` in Vercel → Settings → Environment Variables (Production).
- GitHub → Settings → Secrets → Actions: `APP_URL` (production URL) and `CRON_SECRET` (same as Vercel).
- Vaani → Settings → Webhooks → add `https://<app>.vercel.app/api/vaani/webhook?secret=<VAANI_WEBHOOK_SECRET>`.
  Only the `call_postprocessing` event is processed; other lifecycle events are acknowledged and ignored.
- HubSpot: pipeline "Aangan Enquiries" with stages New enquiry, Consultation booked, Site visit,
  Proposal sent, Won, Lost. Create a deal property `amount_source` (single-line text). If it is
  missing the deal is still created and the source goes into the description.

## Reliability
- A call is saved before anything else, then claimed with a 3-minute lease, so the webhook and the
  15-minute sync never process it twice (no duplicate emails or deals).
- A failing call is retried up to 3 times. The founder is alerted on the first failure and when
  retries stop; the call page then shows a **Retry now** button.

## Known limits / not verified yet
- Vaani fields follow docs.vaanivoice.ai (call-history `data[]` with `Start_time`, `duration_ms`, `from_number`, `post_processing_status`; webhook event `call_postprocessing`). Raw payloads are kept in `calls.raw`. Timestamps without an offset are treated as UTC — confirm on the first live call.
- Call history returns "Invalid client_id format" until an agent exists in the Vaani account; create the agent first.
- "Booked" comes from the transcript (the Cal.com booking happens inside Vaani); the app does not
  call Cal.com.
- Fixture transcripts are case material, kept in a private repo for testing only.
