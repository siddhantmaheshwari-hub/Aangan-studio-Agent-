# Aangan Studio — Phone Enquiry Agent · Components Map

**Live dashboard:** https://aangan-enquiry-agent-lilac.vercel.app (open — no password) ·
**Code:** GitHub (private) `siddhantmaheshwari-hub/Aangan-studio-Agent-`

**In one line:** a Vaani voice agent answers every enquiry call, qualifies the caller honestly against
Nikhil's rules and books a 45-minute design consultation for fits; when the call ends, the app
saves it, has Gemini read it, **decides the status in code**, sends qualified leads to HubSpot and the
team (email + Telegram), and shows every call — transcript and recording — on the dashboard.

---

## The six components

| Label | What it is | Where it lives |
|---|---|---|
| **1. Trigger** | The call ends → Vaani fires the **`call_postprocessing` webhook** (secret-checked) to the app. Other Vaani events (call started, ringing…) are acknowledged and ignored. A daily **8:00 IST digest** runs on Vercel cron. | Vaani → `app/api/vaani/webhook`; `vercel.json` cron → `app/api/cron/digest` |
| **2. Input** | The finished call: transcript, Vaani's summary, pickup/end times, caller number, call id. The **recording** is streamed from Vaani on demand (never stored in the app). | Webhook payload + Vaani REST (`/api/call_details`, `/api/transcript`, `/api/stream`) → `lib/vaani.ts` |
| **3. Context** | What the decision needs beyond the call: **qualified.md** (Nikhil's five criteria), **services.md** (what Aangan does/doesn't do, Pune + PCMC service area, 6-week minimum), **pricing.md** minimum rates (used by code only to catch a clearly-too-low volunteered budget — never spoken, never sent to an AI, never shown), and the caller's earlier calls (same number within 7 days = one enquiry). | `docs/rules/qualified.md`, `docs/rules/services.md` → `lib/rules.ts`, `lib/locality.ts`, `lib/budgetCheck.ts`, `lib/pipeline.ts` |
| **4. Processing** | Save the raw call first → claim a lease (no double processing) → AI extraction → normalise the area (Hinjawadi → Hinjewadi) → scan the agent's lines for any price → **rules engine sets the status** (every rule recorded) → store → deliver outputs once. Failures retried up to 3 times with an alert. | `lib/pipeline.ts`, `lib/priceScanner.ts`, `lib/rules.ts`; Neon Postgres (`migrations/`) |
| **5. AI** | **In the call — Vaani** agent "Aangan Studio Enquiries" (English with auto-detect for Hindi, voice Arushi): asks the questions, checks Cal.com availability and books FIT callers, answers price questions with pricing.md's exact deflection. **After the call — Gemini 3.5 Flash-Lite**: extracts facts with the caller's own words and a 2-line summary into a validated schema. Gemini never decides the status. | `VAANI_SYSTEM_PROMPT.md` (live in Vaani); tools `@Check_availability_booking`, `@book_appointment`; `lib/extract/gemini.ts`, `lib/extract/schema.ts` |
| **6. Output** | **Dashboard** (Overview · Review queue · Calls · System). **HubSpot** contact + deal in the "Aangan Enquiries" pipeline (qualified only; stage *Consultation booked* when booked). **Resend email + Telegram** together: handoff for qualified, URGENT for complaints, failure alerts, daily digest. **Cal.com** booking made during the call. | `app/(dash)/*`, `lib/hubspot.ts`, `lib/notify.ts`, Cal.com via Vaani |

---

## How one call flows

```
 Caller ──► VAANI AGENT (AI) ── checks free slots / books ──► Cal.com (45-min Design consultation)
                │  call ends
                ▼
 TRIGGER    call_postprocessing webhook ─────────────────────► /api/vaani/webhook (secret)
                │
 INPUT      transcript · summary · times · caller · call id  (+ recording streamed on demand)
                │
 PROCESSING save raw call → lease → GEMINI extract (AI) → area → price scan
                │                                         ▲
 CONTEXT        └──── rules engine ◄── qualified.md · services.md · pricing floor (code only)
                │
                ▼  status decided in code
 OUTPUT     Qualified   ─► HubSpot deal + email + Telegram + dashboard
            Escalation  ─► URGENT email + Telegram (never a deal) + dashboard
            Needs review / Incomplete ─► Review queue (founder decides, audited)
            Not a fit / Missed        ─► dashboard
```

## Statuses

| Status | When (source) | What happens |
|---|---|---|
| **Qualified** | Passes all five criteria (qualified.md) | HubSpot deal, handoff email, Telegram |
| **Needs review** | Borderline — never auto-declined (e.g. unknown area, tiny office, budget a bit low, site free only after 10 weeks, decider not involved) | Review queue; the founder's decision is final and logged |
| **Not a fit** | Clear fail: outside Pune/PCMC, advice/decor/furniture/Vastu/structural only, restaurant/hotel/retail/gym, needed in under 6 weeks, budget clearly below any project of that scope | Dashboard only |
| **Incomplete** | Area or property type missing | Review queue |
| **Escalation** | Existing-client complaint, or demands Nikhil / a senior person | URGENT email + Telegram, no sales deal |
| **Missed** | Missed or dropped call | Dashboard only |

## Dashboard (output detail)
- **Overview** — this week's calls with a 7-day chart, speed-to-lead gauge (target < 15 min), KPI
  cards vs last week, *Needs your decision* queue, outcome mix, recent calls, AI quality & running cost.
- **Review queue** — everything waiting for a person, filterable by type.
- **Calls** — every call with status, rule IDs, flags, booking, HubSpot link, email and Telegram delivery.
- **Call page** — decision panel first, why the status was decided, the caller's words linked to the
  transcript, highlighted price lines, recording player, notifications, audit log, retry.
- **System** — what's connected, how a call is handled, the rules in force.

## Guardrails
- **No price figures, ever:** pricing.md's exact deflection in the script; every agent line scanned (`R-PRICE-01`).
- **Status decided by code**, every rule recorded and shown.
- **Never auto-decline a borderline case** → Review queue.
- **No false success:** a message counts as sent only on a 2xx; each channel recorded separately.
- **Secrets** only in `.env.local` / Vercel env vars; webhook, sync, health and cron routes need secrets.
  The dashboard itself is open by the owner's choice.

## Evidence
- **48 automated tests**; **27/27 practice calls** (case transcripts T01–T20 + web-form scenarios F03,
  F05, F06, F08) correct with Gemini on two runs, 99%+ of facts correct.
- **First live call:** Kothrud 3BHK → *Qualified*, booked Mon 12 Oct 9:00 AM, no price spoken despite
  being asked twice, HubSpot deal created, email + Telegram delivered, 3:53 recording plays on the dashboard.
