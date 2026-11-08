// The guided sponsor presentation: seven scenes on the real product.
export interface Scene {
  n: number;
  title: string;
  href: string;
  say: string;
  do: string;
  action?: { label: string; kind: "reset" | "scan" | "follow_up" | "payment" };
}

export const SCENES: Scene[] = [
  { n: 1, title: "Meet the business", href: "/overview", say: "Metro Roofing (fictional) tracks estimates in Excel and invoices in QuickBooks. The owner wants more sales without hiring an administrator, but follow-ups and collections slip.", do: "Show the Overview: real pipeline and balances calculated from their records, but nothing investigated yet.", action: { label: "Reset to baseline", kind: "reset" } },
  { n: 2, title: "Activate intelligence", href: "/overview", say: "No question to type. One click and the Intelligence Engine decides what to investigate and dispatches the Readiness, Sales and Financial agents.", do: "Click Run AI Intelligence Scan and narrate the live activity: AI decisions vs. software analysis.", action: { label: "Run AI Intelligence Scan", kind: "scan" } },
  { n: 3, title: "Discover opportunities", href: "/inbox", say: "Each finding is backed by specific records. The dollar values are computed by software from those records; the AI explains why they matter.", do: "Open the Intelligence Inbox and click the top finding to show its evidence and source rows." },
  { n: 4, title: "AI prepares work", href: "/actions", say: "The agents didn't just report. They drafted personalized follow-ups and payment reminders and created tasks, all waiting for the owner.", do: "Open the Action Center. Open a draft, edit a line, approve it. Note: approved, not sent." },
  { n: 5, title: "Owner takes action", href: "/finance", say: "The owner records a payment from a customer.", do: "Use Demo Mode → Apply a sample change → Record payment. Watch the overdue balance and findings update immediately.", action: { label: "Record sample payment", kind: "payment" } },
  { n: 6, title: "Intelligence adapts", href: "/overview", say: "Software already re-verified the findings. A follow-up scan has the agents re-check their work instead of repeating stale issues.", do: "Run a follow-up scan; show resolved findings and the updated briefing.", action: { label: "Run follow-up scan", kind: "follow_up" } },
  { n: 7, title: "Sponsor impact", href: "/sponsor-access", say: "A sponsor sees adoption, AI activation, AI-prepared work, owner approvals and software-verified outcomes across all participating businesses, without seeing anyone's records.", do: "Sign in as the fictional sponsor program and walk the funnel." },
];

// Kept for the original readiness walkthrough page (/demo).
export const DEMO_STEPS = [
  { minute: 1, title: "Meet the business", href: "/onboarding", say: "Metro Roofing tracks estimates in Excel and invoices in QuickBooks.", do: "Use Metro Roofing's answers, then Create my readiness report." },
  { minute: 2, title: "AI Readiness finds a problem", href: "/readiness", say: "Upload the estimates spreadsheet without contact dates.", do: "Fix This Now on Sales pipeline analysis → metro-roofing-estimates.xlsx." },
  { minute: 3, title: "AI helps fix the problem", href: "/readiness", say: "Readiness explains what's missing and offers the fix.", do: "Fix This Now on Missed follow-up detection → upload the updated sheet." },
  { minute: 4, title: "Sales Intelligence delivers value", href: "/sales", say: "The import automatically started an intelligence scan.", do: "Review the findings and prepared drafts." },
  { minute: 5, title: "Financial and sponsor impact", href: "/finance", say: "Upload invoices; the import triggers a finance scan.", do: "Upload metro-roofing-invoices.csv, then open the Sponsor Dashboard." },
];
