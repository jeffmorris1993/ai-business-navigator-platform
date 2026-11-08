export const DEMO_STEPS = [
  {
    minute: 1,
    title: "Meet the business",
    href: "/onboarding",
    say: "Metro Roofing tracks estimates in Excel and invoices in QuickBooks. The owner's problem: following up with customers. They want more sales without hiring another administrator.",
    do: "Click \"Use Metro Roofing's answers\", then \"Create my readiness report\".",
  },
  {
    minute: 2,
    title: "AI Readiness finds a problem",
    href: "/readiness",
    say: "Before seeing any records, the platform only says what might help and what it still has to verify. Now we upload the real spreadsheet.",
    do: "Click \"Fix This Now\" on Sales pipeline analysis, choose the sample \"metro-roofing-estimates.xlsx\", confirm the column mapping. Pipeline becomes Ready; Missed follow-up detection says Needs Setup.",
  },
  {
    minute: 3,
    title: "AI helps fix the problem",
    href: "/readiness",
    say: "The readiness agent explains it can't tell who needs follow-up because there are no last-contact dates, and offers to fix it right now.",
    do: "Click \"Fix This Now\" on Missed follow-up detection. Upload the updated sheet (or type dates). Watch the status change to Ready with an explanation.",
  },
  {
    minute: 4,
    title: "Sales Intelligence delivers value",
    href: "/sales",
    say: "The Sales Agent uses real tools on the normalized records: 11 open estimates, $62,000 in potential pipeline value, ranked. Not guaranteed revenue.",
    do: "Click \"Analyze My Sales Opportunities\". Show the agent activity, then draft a follow-up and approve it (it's never sent automatically).",
  },
  {
    minute: 5,
    title: "Financial Intelligence and sponsor impact",
    href: "/finance",
    say: "Upload invoices, readiness verifies due dates and balances, and overdue analysis turns on. Then the sponsor view shows adoption across many businesses without exposing anyone's records.",
    do: "Upload \"metro-roofing-invoices.csv\" on Financial Intelligence, review overdue invoices, then open the Sponsor Dashboard.",
  },
];
