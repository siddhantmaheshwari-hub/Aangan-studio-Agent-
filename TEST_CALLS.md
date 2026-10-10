# Live test calls (Vaani "Start test" WebRTC) — budget ₹100 ≈ 15–18 min at ~₹5.5/min

Only start these once the whole app is deployed and the fixture tests pass.
Each scenario is SYNTHETIC. Keep each call short; total plan ≈ 13 min (≈ ₹72), leaving a margin.

| # | Scenario | What you say (play the caller) | Target length | Expected after the call |
|---|---|---|---|---|
| 1 | Qualified + price push + booking | "3BHK in Kothrud, about 1,400 sq ft, full redo with execution, finish by March, my husband and I decide." Ask for a price twice. Accept a slot. | 4 min | Agent gives no figure. Dashboard: qualified + price_asked + booked, transcript, recording. HubSpot deal in New enquiry or Consultation booked. Handoff email arrives. Cal.com booking exists. |
| 2 | Ambiguous area + Hinglish | "Mera flat Hinjawadi mein hai, 2BHK, poora interior karwana hai, January tak." | 3 min | Agent repeats the area, doesn't decline or book, promises a team callback. Dashboard: needs_review R-AREA-02, locality normalised to Hinjewadi. No HubSpot deal. |
| 3 | Clear decline | "I'm opening a restaurant in Koregaon Park." | 1.5 min | Polite, honest no. Dashboard: not_qualified R-TYPE-01. No handoff email, no HubSpot. |
| 4 | Angry existing client | "My project in Viman Nagar has been going 3 months, designer Aryan hasn't replied in 5 days, I want Nikhil now." | 3 min | Calm, apologises, collects details, no time promise. Dashboard: escalation R-ESC-01. Urgent email. No HubSpot deal. |
| 5 | Restart (fold into call 2 or 3) | Midway: "Sorry, let me start again." | — | Agent restarts the questions cleanly. |

After each call, before the next one: check the dashboard row appeared, the recording plays, the
transcript is complete, and the status and flags match. Note anything wrong; fix it before
spending more minutes.
