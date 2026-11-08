# Status: completed features and limitations

Verified on 2026-11-08 with live OpenAI (`gpt-5.4-mini`) against the hosted Supabase project, using `npm test` (45 unit tests), `e2e/demo-flow.ts` (browser walk-through of all five demo minutes) and `e2e/acceptance.ts` (acceptance tests 2–9).

## Acceptance tests

| # | Test | Result | How verified |
|---|---|---|---|
| 1 | Readiness before/after (Metro) | Pass | demo-flow minutes 1–4; unit tests |
| 2 | Different column names → same structure, confirmation, ambiguity | Pass | acceptance.ts (live AI mapping), unit tests |
| 3 | Real agent tool calling for "Which customers should I follow up with?" | Pass | demo-flow minute 4, acceptance.ts (Advisor) |
| 4 | Financial accuracy; payment changes balances and analysis | Pass | unit tests, demo-flow minute 5, acceptance.ts |
| 5 | Manual salon business | Pass | acceptance.ts, unit tests |
| 6 | Cash forecast without cash info → lists what's missing | Pass | acceptance.ts, unit tests |
| 7 | Human approval of drafts and sensitive agent actions | Pass | demo-flow (draft edit/approve), acceptance.ts (payment waits for approval) |
| 8 | Sponsor privacy | Pass | demo-flow, acceptance.ts |
| 9 | Live AI verification / clear unavailability without a key | Pass | acceptance.ts with a second server lacking a key |

## Completed

- Business selection, onboarding (spreadsheet and manual paths), persistent Supabase data, five fictional businesses plus a labeled simulated cohort.
- Readiness: 8 capabilities × 4 statuses with evidence, missing items, next step and Fix This Now; five readiness areas; initial report from answers; automatic reassessment on import, mapping, record edits, task completion, manual entry, payments; stale-data downgrade; history timeline; readiness tasks created and auto-closed from data.
- Smart Data Importer for sales, invoices, payments, expenses, appointments; AI mapping with code-enforced rules; status questions; append / update-matching / replace modes; saved mappings; private original files with download; source row on every record.
- Sales: pipeline, missed follow-ups (ranked, with evidence and source), stalled proposals, trends, appointment capacity, AI or template drafts, tasks.
- Finance: overdue invoices with aging and per-customer totals, balances, payment recording, expense trends by category, financial summary, cash scenarios, reminders, tasks.
- Agents: 26 server-side tools with zod validation, per-agent permissions, approval gating, timeouts, iteration cap; streamed real activity; run and step logs; Advisor with conversation memory.
- Action Center, Sponsor Dashboard (multi-sponsor, counts only, small-group suppression), guided 5-minute demo.

## Limitations

- **Authentication is a demo picker**, not real login. See SECURITY_GAPS.md.
- No direct QuickBooks/CRM/POS integrations; data arrives by CSV/XLSX upload or manual entry.
- No email sending; approved drafts are copied or exported as text.
- Imported payment files are stored and linked to invoices but don't change invoice balances (the invoice export's Amount Due is treated as current). Payments recorded in the app do reduce balances.
- Matching rows on "update" imports uses customer + quote date (sales) or invoice number (invoices); other layouts may add new rows instead of updating.
- Old `.xls` files aren't supported (save as .xlsx or .csv).
- Sponsor "verified improvements" are readiness-status upgrades and completed actions; revenue impact isn't measured.
- The simulated cohort is fictional and exists only to show program scale; it can be excluded on the dashboard.
- Agent answers vary run to run (numbers come from tools and stay the same).
- `DEMO_TODAY` fixes "today" for sample data; set it empty for real-time dates.
