# Aangan enquiry agent — layered UX plan

Method: Layered UX Builder (L0–L10). Depth: **standard**, with a human gate on every action that
leaves the dashboard (emails, CRM deals).

---

## L0 · Project card
**App description.** I am building a phone agent plus after-call dashboard for Aangan Studio's
founder and 2-person front desk, so that *every enquiry call is answered, honestly qualified,
and handed to a designer within minutes*, even after hours, with no price ever quoted on the phone.

| | |
|---|---|
| Type | Workflow/automation + voice agent + internal dashboard |
| Primary users | Nikhil (founder, decides review items), front desk (calls back) |
| Owner | Nikhil — owns every "needs review" and escalation decision |
| Inputs | Vaani call transcript, recording, duration; PROXY rules; locality list |
| Constraints | Due Sat 10 Oct; Vercel Hobby (1 cron/day); ₹100 of call minutes; Resend sandbox; no prices |

## L1 · The real problem
The problem isn't "answer the phone". **It's that enquiries die between the call and the
designer.** ~200 enquiries/month · ~48% get no answer within 48 h · answered-within-1h converts
**4×** better. Projects average ₹8–14 lakh, so each lost enquiry is expensive.

## L2 · Nine checks
| # | Check | Verdict | Evidence |
|---|---|---|---|
| 01 | Problem real? | YES | 48% unanswered in 48 h (case data) |
| 02 | Repeated? | YES | ~200 calls/month, same questions each time (T01–T20) |
| 03 | Input available? | YES | Vaani gives transcript + recording; fixtures for testing |
| 04 | Output valuable? | YES | Handoff email + HubSpot deal the designer can act on |
| 05 | Impact measurable? | YES | Median call-end → handoff, shown on the dashboard |
| 06 | Failure risk OK? | YES, with gates | Worst case: a good lead auto-declined → **never auto-decline borderline** (→ needs review) |
| 07 | Judgment protected? | YES | Rules decide only clear cases; the founder decides the rest and can override any status |
| 08 | ROI? | YES | ~₹5.5/min + fractions of a rupee of Gemini vs a ₹8–14 lakh project |
| 09 | Owner clear? | YES | Nikhil owns the review queue; every decision is logged with a reason |

**The Cut.** *The founder wants every caller treated honestly and no lead lost.*

| Automated | Stays human |
|---|---|
| Answering, asking the questions, booking FIT callers (Vaani) | Deciding every borderline case |
| Extracting facts with quotes (Gemini) | Calling back escalations (no time promised on the call) |
| Applying clear rules (code) | Changing any status (with a reason, audited) |
| Creating the HubSpot deal + handoff email for clear fits | Pricing — always the designer, never the agent |

**Killed features (and the check that killed them):** auto-decline of borderline areas (06);
the agent quoting a "rough range" (06 — wrong number is unrecoverable trust damage); AI deciding
status (07); auto-callback promise to complainants (09 — nobody can own a promised time).

## L3 · Strategy
- **Goal →** every completed enquiry call becomes a handoff or a decision item **within 15 minutes of the call ending**, with zero price figures spoken.
- **Metrics:** median call-end → handoff (target < 15 min) · % calls processed (target 100%) · price figures spoken (guardrail: 0) · delivery failures (guardrail: 0 unseen).
- **System type:** hybrid. Vaani is the agent inside the call; **after the call it is a workflow** (trigger → input → rule → action → notify → log). Lowest autonomy that works: AI *suggests* facts, code decides, human approves the grey zone.
- **Model plan:** Gemini 3.5 Flash-Lite (extraction is mechanical; temperature 0; zod schema; one retry). Cost ≈ input tokens × input rate + output tokens × output rate per call, recorded per call in `cost_events`. Step up a tier only if `npm run replay -- --gemini` grades below target.

## L4 · Experience
**Principles.** Honest over persuasive · The founder's judgment over automation speed ·
Evidence over assertion (every fact has the caller's words) · One next step over many options.

**Trust & control plan**
| Element | Where |
|---|---|
| Review gate | "Needs your decision" queue (Overview) → decision panel at the top of the call page |
| Approval tiers | View = free · status change = logged with reason · outbound (email/deal) = consequence preview + explicit confirm |
| Transparency | "How the status was decided" (every rule, fired or not) · quotes · price lines highlighted · "Written by AI" label |
| Control | Override any status, undo an override, retry a failed call |
| Limits | PROXY rules labelled; "Not mentioned" instead of guesses; estimates labelled |
| Privacy | Caller numbers never sent to Gemini (transcript only); Vaani key never reaches the browser; recordings streamed behind login |

## L5 · Flow & structure

**Components map**
| Lane | Trigger | Input | Context | Processing | Output |
|---|---|---|---|---|---|
| Caller | Rings Aangan | Answers questions | | | Booked slot / honest no / callback promise |
| Vaani (AI) | Picks up | Transcript, recording | System prompt, FAQ, Cal.com | Qualifies in call, books FIT callers | Post-call webhook |
| App (Vercel) | Webhook / 15-min sync | Fetches call details | Earlier calls from same number; locality list; PROXY rules | Save raw → extract → normalise → price scan → rules | Status + rule IDs + flags |
| Gemini (AI) | | Transcript | Field guide | Extract facts + quotes + summary | JSON (zod-validated) |
| Neon (DB) | | | | Stores calls, enquiries, rules, notifications, costs, audit | Dashboard data |
| HubSpot | | | | | Contact + deal (qualified only) |
| Resend / Telegram | | | | | Handoff · urgent escalation · failure alert · daily digest |
| Founder | Opens queue | Reads evidence | | Decides | Override + reason (audited) |

**API call flow**
1. Vaani → `POST /api/vaani/webhook` (secret checked) — *or* GitHub Actions → `GET /api/sync` every 15 min
2. App → Vaani `GET /api/call_details/{id}` + `/api/transcript/{id}`
3. App → Neon: insert raw call (idempotent by call id) · claim a 3-minute lease (no double processing)
4. App → Gemini: extract (≤ 2 model calls) → Neon `cost_events`
5. Locality normalisation, price scan, rules — **local, no API call**
6. App → Neon: enquiry, rule evaluations, audit
7. Qualified → HubSpot (search contact, create contact, create deal) → Resend handoff (retry once) + Telegram to the team chat
8. Escalation → Resend urgent email (no HubSpot)
9. Failure → `pipeline_errors` + founder alert (first failure and when giving up after 3)
10. Founder → dashboard → `POST /api/calls/{id}/override` → outputs re-run idempotently

**State inventory**
| Screen | Empty | Loading | Error | Partial |
|---|---|---|---|---|
| Overview | "Nothing yet / nothing waiting" | Skeleton | DB-missing vs server error message | Queue + metrics independent |
| All calls | "No calls match — Clear filters" | Skeleton | Same | "Not processed", "failed N×", dry run vs not sent |
| Call page | No transcript / no recording (replay) | Skeleton | 404 for unknown id | Not-processed card with Retry |

## L6 · Screens (one job, one primary action each)
| Screen | Job | Primary action |
|---|---|---|
| Overview | What needs me now? | Open the top queue item |
| All calls | Find any call | Filter → open a call |
| Call page | Decide this enquiry with evidence | Save decision (or Retry if unprocessed) |
| Login | Get in | Open dashboard |

## L7 · Interface
Tokens in `app/globals.css`: warm neutrals + one terracotta accent, semantic ok/warn/danger/info/neutral,
light and dark. All 36 text/background pairs measured ≥ 4.5:1 (lowest 5.0:1). Type: Tailwind
scale, 12 px minimum. Targets ≥ 36 px tall. Visible focus ring everywhere; skip link; status never
conveyed by colour alone (labels + ✓/✕).

## L9 · Quality & grading

**Heuristic issue log** (found by grading the first build; all fixed)
| Issue | Heuristic | Sev | Fix |
|---|---|---|---|
| ₹542 Vaani cost shown for fixture replays | 2 match real world · rule 6 | 3 | Vaani minutes counted for live calls only |
| Decision form at the bottom, after 13 rules + 26 fields | 1 visibility · L4 gate | 3 | Decision panel first; queue on Overview |
| 11 equal tiles, no "what needs me" | 8 minimalist · Hick | 2 | "Needs your decision" queue, grouped metrics |
| Raw codes (`price_figure_spoken`, `design_and_execution`) | 2 match real world | 2 | Plain labels, codes kept in tooltips |
| "Missing" for things simply not discussed | 2 / 9 | 2 | "Not mentioned"; key facts always, others only when said |
| Price figure not tied to evidence | L4 transparency | 2 | Offending agent line highlighted; quotes linked to lines ("Used for: Area") |
| Override sends email/deal with no preview | 5 error prevention | 2 | Consequence preview + explicit confirm for outbound actions |
| Grey text < 4.5:1, 10–11 px text | WCAG 1.4.3 | 2 | Tokens, all pairs ≥ 4.5:1, 12 px min |
| No recovery for a failed call | 9 recover from errors | 2 | Retry button; attempts capped at 3 |
| "—" for email/HubSpot ambiguous | 1 visibility | 1 | "Not needed" / "Dry run" / "Not sent yet" / "Not delivered" |
| Webhook + sync could double-process (duplicate emails) | Reliability | 3 | Processing lease per call |
| A broken call would alert every 15 min forever | Reliability | 2 | Alert on first failure and when giving up |

**Scorecard**
| Dimension | Pts | Before | After | Note |
|---|---|---|---|---|
| Problem fit | 10 | 9 | 9 | |
| Goal achievement | 15 | 8 | 9 | Measurable on dashboard; real target needs live calls |
| Flow efficiency | 10 | 6 | 9 | Queue → call page → decision in 2 clicks |
| Usability (heuristics) | 15 | 7 | 13 | No severity 3–4 left |
| Human control & trust | 10 | 6 | 9 | Gate, preview, confirm, undo, audit |
| Visual & interface | 10 | 5 | 8 | Tokens, states, dark mode |
| Accessibility | 10 | 5 | 8 | Contrast measured; keyboard/screen-reader pass still to do by hand |
| AI / system quality | 10 | 6 | 9 | Gemini 3.5 Flash-Lite: 23/23 statuses on two runs, 99.1–99.7% field accuracy, 1 model call per call |
| Security & privacy | 5 | 4 | 5 | |
| Performance & reliability | 5 | 3 | 5 | Lease, capped retries, idempotent |
| **Total** | 100 | **59** | **84** | "Ship with fixes logged" |

**AI eval (10 Oct):** first run 22/23 — T07 used the model's own calendar for Diwali instead of the
"three weeks" said in the call, "booked" was set when a caller only agreed to book, and 14 of 35
model calls were retries because `rooms` came back as a list. Fixed in the field guide and schema
(not by changing model): 23/23 on two runs, 99.1–99.7% of graded fields, 21 model calls for 21
calls, ~2,000 tokens per call.

**Still open (honest):** live test
calls per TEST_CALLS.md, Vaani payload mapping check on the first real call, a 5-person usability
round, manual keyboard + screen-reader pass.

## L10 · Next
1. After the four live calls: compare median handoff time against the 15-minute target.
2. Replace PROXY rules when Nikhil's qualified.md / services.md arrive; rerun the fixture table.
3. If Gemini grades below 95% on status-changing fields, tighten the field guide before changing model.
