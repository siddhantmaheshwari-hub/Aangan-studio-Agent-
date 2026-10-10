# Start here — Aangan agent in Claude Code (due today, Sat 10 Oct, end of day)

## Order of work today
| Step | What | Rough time |
|---|---|---|
| 1 | Accounts and keys (table below) | 45 min |
| 2 | Claude Code builds the app on fixtures (no live calls) | 2–3 h |
| 3 | Deploy to Vercel; set the Vaani agent: system prompt, voice, language, Cal.com booking action, post-call webhook if offered | 45 min |
| 4 | HubSpot and Resend wired and tested with fixtures (Telegram only if you want a fallback) | 1 h |
| 5 | Live test calls per TEST_CALLS.md | 20 min |
| 6 | Final check, push to GitHub, submit components map | 20 min |

## 1. Accounts (values go into .env.local and Vercel env vars — never into chat)
| Service | Do this | You need |
|---|---|---|
| GitHub | Private repo `aangan-enquiry-agent` | Repo URL |
| Neon | Project near India, database `aangan` | Pooled connection string |
| Gemini | Key from Google AI Studio | `GEMINI_API_KEY` |
| Vaani | Settings > API Keys. After deploy, find the agent under Agents | `VAANI_API_KEY`, agent ID |
| Cal.com | Event type "Design consultation", 45 min, designers' availability | Connected inside Vaani |
| HubSpot | Private app with CRM contacts + deals scopes; create pipeline "Aangan Enquiries" with the stages in CLAUDE.md | `HUBSPOT_TOKEN`, pipeline ID |
| Resend (primary) | API key. Without a verified domain, check whether you can only send to your own address; if so, use your address as the team inbox for today | `RESEND_API_KEY`, sender, team and founder emails |
| Telegram (optional fallback) | Only if you want a backup: @BotFather → new bot → add to a group → chat ID | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Vercel (Hobby plan, already linked to GitHub) | After the first push: Add New → Project → import the repo. Add all env vars for Production. Note the production URL for the Vaani webhook | Production URL |

Read every provider email today (pause, quota and billing warnings break the app).

## 2. First message to Claude Code
```
Read CLAUDE.md, VAANI_SYSTEM_PROMPT.md and TEST_CALLS.md fully. The deadline is today, so we
build the smallest version where every visible feature works.

Without writing code yet, show me:
1. The plan: files, Neon schema, API routes, dashboard pages, and build order.
2. How post-call data will reach us (Vaani webhook vs polling) and what you need me to check in
   the Vaani dashboard. I will paste the Vaani docs if you need them.
3. Anything in CLAUDE.md you think is wrong or risky.
Wait for my OK.

Then build in this order, committing and pushing after each working step:
1. Next.js app, .gitignore (.env* ignored), Neon migrations.
2. Rules engine, price scanner, locality aliases — with unit tests.
3. Pipeline on fixtures (fake extractor, then Gemini) — show me the results table.
4. Dashboard (login, calls table, call detail with transcript + recording, overview, health strip).
5. Deploy to Vercel. Then HubSpot and Resend (Telegram only as a fallback when Resend fails) —
   tested with fixtures first.
6. Post-call webhook or GitHub Actions polling + health alerts.
Explain each step simply. Never print my keys.
```

## 3. In the Vaani dashboard
- Paste `VAANI_SYSTEM_PROMPT.md` (below its line) into the system prompt.
- Language: English with Hindi as secondary; pick a warm, clear voice.
- Actions → Integrations → Booking appointment → connect Cal.com (booking happens in the call).
- If there is a post-call webhook setting, point it at `https://<your-app>.vercel.app/api/vaani/webhook`.

## 4. Done means
- Fixture tests pass; four live test calls appear on the deployed dashboard with recordings.
- Qualified call → HubSpot deal + handoff email; complaint → urgent email, no deal.
- `.env*` not in GitHub. Health strip green.
