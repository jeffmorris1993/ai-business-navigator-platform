# Status: completed features and limitations

Verified on 2026-11-08 against the hosted Supabase project with live OpenAI (`gpt-5.4-mini`):
- `npm test` — 55 unit tests (calculations, readiness rules, importer, agent loop, finding verification/de-duplication).
- `e2e/intelligence-flow.ts` — proactive engine acceptance tests (below).
- `e2e/demo-flow.ts` — original readiness walkthrough in a browser.
- `e2e/acceptance.ts` — original acceptance tests (importer, salon, approvals, cash refusal, sponsor privacy, no-key mode).

## Proactive Intelligence Engine — acceptance tests

| # | Test | Result | How it works |
|---|---|---|---|
| 1 | Proactive scan | Pass | **Run AI Intelligence Scan** starts the engine; no question typed. |
| 2 | Actual AI reasoning | Pass | An orchestrator model chooses orientation tools, decides which specialist agents to dispatch and with what focus; specialists pick their own tools, record findings and prepare work; the orchestrator re-prioritizes. All steps logged in `agent_runs` / `agent_steps`. |
| 3 | Persistent findings | Pass | `findings` table; Inbox survives refresh. |
| 4 | Prepared work | Pass | Drafts and tasks linked to findings (`finding_id`), reviewable in the Action Center. |
| 5 | No duplicates | Pass | De-dup by key, subject and overlapping records (related sales categories form one family); a narrower restatement is treated as "covered". |
| 6 | Updated information | Pass | Payments/record edits trigger deterministic re-verification: findings resolve ("verified by software") or recompute values; follow-up scans see the new state. |
| 7 | Readiness gating | Pass | Analysis tools refuse when data is missing; `record_finding` rejects claims the records don't support (e.g. cash risk without cash on hand). |
| 8 | Import trigger | Pass | The import request itself runs the scan for the affected area and streams it. |
| 9 | Demo reset | Pass | Demo Mode → Reset restores the selected sample business only. |
| 10 | Visual quality | Reviewed | Screens reviewed at 1440, 820 and 390 px. |
| 11 | Honest AI status | Pass | No key → scan returns `live_ai_unavailable`; "Run software checks only" is clearly labeled; failed/interrupted scans show as failed. |
| 12 | Existing functionality | Pass | Original e2e and acceptance suites pass. |

## Architecture notes
- **Layer 1 (software):** `lib/calc`, `lib/readiness`, `lib/intelligence/evaluate.ts` — values, verification, gating, de-dup.
- **Layer 2 (AI):** `lib/intelligence/scan.ts` (orchestrator + `delegate_investigation`), `lib/agents/*` (tools, loop with parallel tool calls, prompts).
- **Layer 3 (actions):** findings, drafts, tasks, approvals; sensitive tools (payments, approvals, record edits) are never available inside a scan.
- **Reliability:** scans run inside the streaming request (`maxDuration` 300 s); one running scan per business (unique index); scans left running >6 min are marked failed; per-tool timeouts and iteration caps.

## Limitations
- **Authentication is a demo picker**, not real login. See SECURITY_GAPS.md.
- Scans run while the request is open. If the browser disconnects mid-scan the server may stop; the scan is then marked failed (findings saved so far remain). A queued background worker would remove this dependency.
- No scheduled scans yet (designed to be added; not needed for the demo).
- Model output varies between runs: titles, wording and which findings are split vs. grouped can differ. Numbers always come from software.
- No direct QuickBooks/CRM integrations (CSV/XLSX import or manual entry) and no email sending (drafts are approved and copied/exported).
- Imported payment files are stored and linked but don't change invoice balances; in-app payments do.
- The simulated sponsor cohort is fictional and has no AI-scan data; AI work figures come only from businesses used in the app.
- `DEMO_TODAY` fixes "today" for sample data.
