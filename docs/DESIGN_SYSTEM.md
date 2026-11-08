# Sirrom Intelligence Workspace: design system

The interface is a business intelligence workspace, not an admin dashboard. Midnight surfaces hold the intelligence (the navigation rail, the scan, agent panels). Pearl surfaces hold the business's own work. Most content sits directly on the canvas, separated by hairlines. Cards are kept for things that need a boundary.

## Tokens (`app/globals.css`, Tailwind v4 `@theme`)

| Role | Token | Value | Use |
|---|---|---|---|
| Canvas | `canvas` | #f3f2ee | Page background |
| Raised | `surface` | #fdfcfa | Panels, tables |
| Inset | `subtle` | #ecebe6 | Callouts, table heads |
| Hairline | `line` / `line-strong` | #e2e0da / #cfccc4 | Dividers |
| Midnight | `midnight`, `-2`, `-3`, `-line` | #0e1218 … | Rail, scan stage, agent panel headers |
| Text on dark | `night`, `-2`, `-3` | #e9ebee … | Inside `.on-dark` |
| Ink | `ink`, `-2`, `-3`, `-4` | #0b0d10 … | Text |
| Signal | `lime` | #c8f04b | Brand node, active nav, live scan, primary scan action. Use sparingly. |
| Interaction | `cobalt` | #2f62f5 | Links, selection, focus |
| Verified | `teal` | #0f8b74 | Software-verified, ready, positive |
| Attention | `amber` | #c98a2b | High priority, needs review |
| Urgent | `red` | #c2453a | Critical, overdue |

Older aliases (`brand-*`, `slate-*`, `emerald-*` and so on) are remapped, so untouched markup stays on-palette.

## Type
- **Display:** Fraunces Variable (`font-display`), self-hosted. Used for page titles, the briefing headline, section titles and finding titles.
- **UI:** Geist Sans. **Metadata and tool names:** Geist Mono.
- **Scale:** `text-display-xl` 46, `text-display` 34, `text-title` 22, `text-heading` 17, `text-body` 15, `text-body-sm` 14, `text-label` 12.5, `text-metric` 38.
- **Numbers:** always `tnum` (tabular numerals). `lib/utils.ts` teaches tailwind-merge the custom sizes so they aren't dropped as colors.

## Components
- **Brand:** `brand/mark.tsx` (`SirromMark`, `Wordmark`) and `brand/public-header.tsx`.
- **UI primitives:** `ui/button` (variants default, primary, signal, night, secondary, ghost, success, danger), `ui/tabs` (`LinkTabs`, `Segmented`), `ui/sheet` (right drawer), `ui/skeleton`, `ui/card` (Card, NightPanel, SectionHeader, Eyebrow).
- **App:** `status.tsx`:
  - `PageHeader`;
  - `Stat` / `StatStrip`, an open metric band;
  - `Priority`, a vertical marker plus word;
  - `StatusPill`, a dot plus word;
  - `AgentGlyph`: a distinct SVG for each agent;
  - `EmptyState`.
- **Findings:** `findings.tsx`: `FeaturedFinding`, `FindingList` (ranked rows) and `FindingValue`.
- **Scan:** `scan-console.tsx`:
  - `IntelligenceBriefing`, the signal panel;
  - `ScanStage`, the live investigation.

  It is driven only by stream events and broadcasts `sirrom:scan` to the rail's `AgentRoster`.
- **Work:** `action-center.tsx` (queue tabs, review sheet) and `draft-dialog.tsx` (`DraftEditor`, `ApprovalPanel`: "Approving … Nothing is sent").
- **Agent conversations:** `agent-panel.tsx` (midnight header) around `AgentChat`.

## Rules
- Keep AI interpretation (cobalt, Brain icon) visually distinct from software verification (teal, ShieldCheck icon).
- Never show progress percentages for AI work. Stages and lane states change only on real events.
- Motion (fade-up, ring, connector flow) lasts 150–320 ms and is disabled under `prefers-reduced-motion`.
- Focus: a 2px cobalt outline, lime inside `.on-dark`.
- Layout: content max width 1440px. The rail collapses to a portal sheet below `lg`. The Inbox switches from list to detail on mobile.
