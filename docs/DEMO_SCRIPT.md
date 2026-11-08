# Five-minute sponsor demo

Open the app and click **Start the 5-minute demo** (or go to `/demo`). This resets Metro Roofing (fictional) to a blank business and signs you in as its owner. A guide in the lower-left corner shows what to say and click for each minute; it can be minimized.

**Before presenting:** confirm the header shows **Live AI: on**. If it says unavailable, the deterministic analysis still works, but agent chat panels will explain that live AI is off.

## Minute 1 — Meet the business
- Say: Metro Roofing tracks estimates in Excel and invoices in QuickBooks. Their problem is following up with customers; the goal is more sales without hiring another administrator.
- Do: **Use Metro Roofing's answers** → **Next** → **Create my readiness report**.
- Point out: the initial report separates what they have, what isn't verified, what's missing and what might help. Nothing is marked Ready, because no records have been inspected.

## Minute 2 — AI Readiness finds a problem
- Do: **Upload my spreadsheet** → sample **metro-roofing-estimates.xlsx**.
- Point out the mapping screen: "Suggested by AI" (Homeowner → Customer, Bid Amt → Estimate value, ...). Owner confirms.
- After import: **Sales pipeline analysis → Ready**, **Missed follow-up detection → Needs Setup**: "Last contact date missing on 18 open estimates."

## Minute 3 — AI helps fix the problem
- Do: on Missed follow-up detection click **Fix This Now**. Read the agent's explanation aloud.
- Upload **Updated estimates (with Last Call)** (or type dates in the "Enter dates here" tab, marking unknowns).
- Point out: 40 existing records updated, the status change **Needs Setup → Ready**, and why. 2 estimates marked "Unknown" are excluded, not guessed.

## Minute 4 — Sales Intelligence delivers value
- Do: **Analyze My Sales Opportunities**.
- Point out: "11 open estimates totaling $62,000 — potential pipeline value, not guaranteed revenue", ranked table with source file and row for each record.
- The Sales Agent runs automatically; show the **Agent activity** list (real tool calls such as `find_stale_opportunities`) and the live model name.
- Click **Draft follow-up** on Dana Whitfield → edit → **Approve**. Note: "Approved · not sent" — no email integration exists, so nothing is sent.

## Minute 5 — Financial Intelligence and sponsor impact
- Do: Financial Intelligence → sample **metro-roofing-invoices.csv** → confirm (Amount → invoice total, Open Balance → amount still owed).
- Point out: 5 overdue invoices, **$31,700.00**, aging chart. Optionally **Record payment** on Imani Carter ($1,400) → total drops to $30,300.00.
- Then **Sponsor Dashboard** → sign in as Northstar. Show enrollment, readiness improvement, capabilities activated, agent adoption, action completion. Note the privacy banner and that simulated cohort businesses are labeled and can be excluded.

Closing line: Sirrom doesn't just teach AI. The software gets a business ready, puts AI to work on its own records, and measures what happens next, for every business in a sponsor's program.
