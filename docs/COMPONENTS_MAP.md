# Aangan Studio — Phone Enquiry Agent · Components Map

**Live dashboard:** https://aangan-enquiry-agent-lilac.vercel.app · **Code:** GitHub (private) `Aangan-studio-Agent-`

One sentence: a Vaani voice agent answers every enquiry call, qualifies the caller honestly against
Nikhil's rules, books a consultation for fits, and after the call the app stores everything, decides
the status in code, hands qualified leads to the team (HubSpot + email + Telegram) and shows every
call — transcript and recording — on a dashboard.

---

## The six components

| Label | What it is here | Where (system → file) |
|---|---|---|
| **1. Trigger** | A call ends → Vaani sends the `call_postprocessing` webhook to the app. Backup: `/api/sync` polling. Daily 8:00 IST digest via Vercel cron. | Vaani webhook → `app/api/vaani/webhook/route.ts`; `app/api/sync/route.ts`; `vercel.json` cron |
| **2. Input** | The finished call: transcript, summary, start/end times, caller number, recording URL. Recording streamed from Vaani on demand. | Vaani REST (`/api/call_details`, `/api/transcript`, `/api/stream`) → `lib/vaani.ts` |
| **3. Context** | What the decision needs beyond the call: Nikhil's 5 criteria (`qualified.md`), services & service area (`services.md`), internal minimum rates from `pricing.md` (code only, never shown or spoken), the caller's earlier calls (same number within 7 days = one enquiry). | `docs/rules/*.md` → `lib/rules.ts`, `lib/locality.ts`, `lib/budgetCheck.ts`, `lib/pipeline.ts` |
| **4. Processing** | Save the raw call first → claim a lease (no double processing) → extract facts → normalise the area → scan agent lines for any price → **rules engine sets the status** → store everything → deliver outputs once. Retries capped at 3. | `lib/pipeline.ts`, `lib/priceScanner.ts`, Neon Postgres (`migrations/`) |
| **5. AI** | **Vaani** (in the call): talks, asks the questions, books FIT callers on Cal.com, never quotes a price. **Gemini 3.5 Flash-Lite** (after the call): extracts facts + the caller's own words + a 2-line summary into a validated schema. Gemini never decides the status. | Vaani agent "Aangan Studio Enquiries" (`VAANI_SYSTEM_PROMPT.md`); `lib/extract/gemini.ts`, `lib/extract/schema.ts` |
| **6. Output** | **Dashboard** (every call, status, rules fired, transcript, recording, decision queue). **HubSpot** contact + deal in "Aangan Enquiries" (qualified only). **Email (Resend) + Telegram**: handoff for qualified, URGENT for complaints, alerts for failures, daily digest. **Cal.com** booking made during the call. | `app/(dash)/*`, `lib/hubspot.ts`, `lib/notify.ts`, Cal.com via Vaani |

---

## How one call flows

```
Caller ──► Vaani agent (AI) ──► books on Cal.com (FIT callers)
                │ call ends
                ▼
   TRIGGER  webhook: call_postprocessing ─────────────► /api/vaani/webhook
                                                              │
   INPUT    transcript · times · number · recording ◄─────────┘ (Vaani REST)
                │
   PROCESSING  save raw call → lease → Gemini extract (AI) → area → price scan
                │                                       ▲
   CONTEXT      └──── rules engine (qualified.md + services.md + pricing floor)
                │
                ▼ status (decided in code)
   OUTPUT   Qualified ─► HubSpot deal + email + Telegram + dashboard
            Escalation ─► URGENT email + Telegram (no deal) + dashboard
            Not a fit / Needs review / Missed ─► dashboard (review queue)
```

## Statuses and who decides

| Status | Meaning | Sent where |
|---|---|---|
| Qualified | Passes all five criteria | HubSpot deal, handoff email, Telegram |
| Needs review | Borderline — never auto-declined | Review queue; the founder decides (audited) |
| Not a fit | Clear fail under qualified.md / services.md | Dashboard only |
| Incomplete | Area or property type missing | Review queue |
| Escalation | Existing-client complaint / demands Nikhil | URGENT email + Telegram, never a sales deal |
| Missed | Missed or dropped call | Dashboard only |

## Guardrails
- **No price figures, ever:** Vaani's script uses pricing.md's exact deflection; every call's agent lines are scanned for figures (`R-PRICE-01`).
- **Status set by code**, with every rule recorded ("why this status" on each call).
- **Never auto-decline a borderline case** → review queue; the founder's override is final and logged.
- **No false success:** a message counts as sent only on a 2xx; failures are retried and shown.
- **Secrets** only in `.env.local` / Vercel env vars; recordings streamed through a login-protected route.

## Evidence
- 48 automated tests; 27/27 practice calls (case transcripts + web-form scenarios) correct with Gemini on two runs, 99%+ of facts correct.
- First live test call: qualified, booked (Mon 12 Oct 9:00), no price spoken, HubSpot deal, email + Telegram delivered, recording plays.
