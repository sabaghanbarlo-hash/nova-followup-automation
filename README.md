# Nova Auto Care — Automated Follow-Up System (Demo)

A free, fully client-side simulation of a WhatsApp/SMS automated follow-up system for a fictional auto shop, **Nova Auto Care**. Built as a portfolio piece to demonstrate lead nurturing automation, campaign logic, and CRM-style dashboards — without any paid messaging infrastructure.

**Live demo:** https://sabaghanbarlo-hash.github.io/nova-followup-automation/

> ⚠️ **This is a messaging simulator.** No real WhatsApp messages or SMS are sent. All "sending" is simulated inside the browser using a fake clock and `localStorage`. A production version would connect to a real provider — see [Production Path](#production-path) below.

---

## Why it's free

Real WhatsApp/SMS sending normally requires paid or externally connected services (Twilio, the WhatsApp Business API, etc.). This demo avoids all of that by simulating the automation logic instead of actually delivering messages:

- No API keys
- No paid services
- No backend — everything runs in the browser
- Data persists locally via `localStorage`

## Features

- **Lead capture form** — Name, phone, service, optional appointment date
- **Automatic follow-up sequences** — every new lead instantly gets a welcome → check-in → encouragement → last-follow-up sequence
- **Campaign builder** — view and edit the delay (in simulated days) before each step of every automation rule
- **Message templates** — editable templates using `{{first_name}}`, `{{service}}`, `{{business_name}}`, `{{appointment_date}}`
- **Message status tracking** — Scheduled, Sent (Demo), Failed, Replied
- **Conversation timeline** — full per-lead message history
- **Stop / Resume campaign** — pause or restart a lead's automation
- **Customer opt-out** — cancels all future messages for that lead
- **Campaign analytics dashboard** — active campaigns, messages sent, responses, conversion rate, follow-ups due, leads recovered
- **"Simulate Next Message" button** — advances a virtual clock and fires the next due message across all active campaigns, with realistic random outcomes (mostly Sent, some Replied, occasional Failed)

## Automation rules included

| Trigger | Sequence |
|---|---|
| **New Lead** | Welcome → wait 1 day → Check-in → wait 3 days → Encouragement → wait 7 days → Last Follow-Up |
| **Appointment Booked** | Confirmation → Reminder → Same-Day Reminder → Thank-You |
| **Missed Appointment** | Recovery message |
| **Completed Service** | Thank-You → Review Request |

Each lead row in the **Leads** tab has buttons to manually fire "Book Appt", "Missed Appt", or "Mark Completed" — standing in for the real-world events (a booking confirmed, a no-show, a job finished) that would trigger these campaigns automatically in production.

## Tech stack

Plain HTML, CSS, and JavaScript. No frameworks, no build step, no dependencies beyond Google Fonts.

- `index.html` — structure and all views (Dashboard, Leads, Campaigns, Templates, Conversations)
- `styles.css` — styling
- `script.js` — all automation logic, state management, and rendering
- Data model: leads, scheduled/sent messages, editable sequence delays, editable templates, and an activity log — all persisted to `localStorage`

## Running it

No install needed. Open `index.html` in any browser, or serve the folder statically (e.g. via GitHub Pages).

## Production path

To turn this into a real automated follow-up system:

1. **Messaging provider** — connect Twilio (SMS) or the WhatsApp Business API for actual delivery, with a webhook to capture real replies.
2. **Backend** — move the lead store, scheduler, and template engine to a server (or serverless functions) so sequences fire even when no one has the page open.
3. **Scheduler** — replace the "Simulate Next Message" button with a real cron/queue system (e.g. a job scheduler or serverless cron) that checks due messages on a timer.
4. **CRM sync** — connect real lead sources (web forms, phone system, booking software) so campaigns trigger automatically instead of via manual buttons.
5. **Compliance** — add proper opt-in language, quiet hours, and STOP/opt-out handling per SMS/WhatsApp regulations (TCPA, WhatsApp Business Policy, etc.).

---

Built by Saba as a freelance web design & automation portfolio piece. Nova Auto Care is a fictional business.
