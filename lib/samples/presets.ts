// Example companies for onboarding presets. FICTIONAL SAMPLE DATA ONLY.
// One source of truth for the seed (data-loaded baseline) and the onboarding UI (from-scratch path).
// Client-safe: no server imports.
import * as S from "./data";
import type { ProfileAnswers } from "../types";

export type PresetSlug =
  | "metro-roofing" | "brightpath-consulting" | "freshstart-cleaning" | "neighborhood-kitchen"
  | "summit-hvac" | "riverside-auto"
  | "beauty-lounge" | "iron-oak-fitness" | "paws-claws-grooming";

export interface SampleFile { file: string; label: string }
export interface ExampleWeek { week_start: string; available_slots: number; booked: number; cancellations: number; unfilled_slots: number; avg_service_value: number; weekly_sales: number }

export interface Preset {
  slug: PresetSlug;
  name: string;
  records: "spreadsheet" | "manual";
  sponsor: "northstar" | "harborline";
  problem: string;
  includes: string[];
  steps: string[]; // the from-scratch walkthrough
  profile: { industry: string; sales_tracking: string; invoicing: string; biggest_challenge: string; ai_experience: string; main_goal: string };
  answers: ProfileAnswers;
  files: { sales?: SampleFile[]; salesUpdate?: SampleFile[]; invoices?: SampleFile[]; payments?: SampleFile[]; expenses?: SampleFile[] };
  weeks?: ExampleWeek[];
}

const yes = { customer_permission: "yes", human_approval: "yes" } as const;

export const PRESETS: Preset[] = [
  {
    slug: "metro-roofing", name: "Metro Roofing", records: "spreadsheet", sponsor: "northstar",
    problem: "Estimates go quiet because nobody tracks follow-ups; a few customers pay late.",
    includes: ["40 estimates (first file has no contact dates)", "Updated estimates with last-call dates", "12 QuickBooks invoices", "6 months of expenses"],
    steps: ["Upload the estimates spreadsheet", "Readiness flags the missing contact dates", "Fix it with the updated sheet", "Upload invoices and expenses", "Run an intelligence scan"],
    profile: { industry: "Roofing and construction", sales_tracking: "Excel spreadsheets", invoicing: "QuickBooks", biggest_challenge: "Following up with customers", ai_experience: "Beginner", main_goal: "Increase sales without hiring another administrator" },
    answers: { lead_sources: "Phone calls and website form", estimate_process: "Owner measures the roof and writes the bid in Excel", followup_tracking: "Memory and sticky notes", manual_tasks: "Calling back homeowners, chasing invoices", records_maintainer: "Owner", reviewer: "Owner", update_frequency: "Weekly", staff_tool_comfort: "medium", financial_access: "Owner and bookkeeper", systems: ["spreadsheets", "accounting", "email"], ...yes },
    files: {
      sales: [{ file: "metro-roofing-estimates.xlsx", label: "Estimates (no contact dates)" }],
      salesUpdate: [{ file: "metro-roofing-estimates-updated.xlsx", label: "Updated estimates (with Last Call)" }],
      invoices: [{ file: "metro-roofing-invoices.csv", label: "QuickBooks invoices" }],
      expenses: [{ file: "metro-roofing-expenses.csv", label: "Expenses" }],
    },
  },
  {
    slug: "brightpath-consulting", name: "BrightPath Consulting", records: "spreadsheet", sponsor: "northstar",
    problem: "Proposals go silent after they're sent and client invoices slip past due.",
    includes: ["14 proposals with unusual column names", "An ambiguous \"Closed\" stage to clarify", "14 client invoices"],
    steps: ["Upload proposals (different column names)", "Tell the importer what \"Closed\" means", "Upload invoices", "Run an intelligence scan"],
    profile: { industry: "Professional services consulting", sales_tracking: "Google Sheets", invoicing: "FreshBooks", biggest_challenge: "Proposals go quiet after we send them", ai_experience: "Some experience", main_goal: "Close more proposals and get paid faster" },
    answers: { lead_sources: "Referrals and LinkedIn", followup_tracking: "Last Email column in the proposal sheet", records_maintainer: "Office manager", reviewer: "Managing partner", update_frequency: "Weekly", financial_access: "Partners and bookkeeper", systems: ["spreadsheets", "email", "accounting"], staff_tool_comfort: "high", ...yes },
    files: { sales: [{ file: "brightpath-proposals.csv", label: "Proposals" }], invoices: [{ file: "brightpath-invoices.csv", label: "Client invoices" }] },
  },
  {
    slug: "freshstart-cleaning", name: "FreshStart Cleaning", records: "spreadsheet", sponsor: "northstar",
    problem: "Commercial clients pay late and supply costs keep creeping up.",
    includes: ["28 invoices with Total and Amount Due", "Payments received", "6 months of expenses"],
    steps: ["Upload invoices (Total vs Amount Due)", "Upload payments and expenses", "Enter cash on hand to unlock cash planning", "Run an intelligence scan"],
    profile: { industry: "Commercial cleaning", sales_tracking: "Word of mouth, no tracking", invoicing: "QuickBooks", biggest_challenge: "Clients paying late", ai_experience: "Beginner", main_goal: "Improve cash flow" },
    answers: { records_maintainer: "Owner", reviewer: "Owner", update_frequency: "Monthly", financial_access: "Owner and bookkeeper", systems: ["accounting", "email"], staff_tool_comfort: "medium", ...yes },
    files: { invoices: [{ file: "freshstart-invoices.csv", label: "Invoices" }], payments: [{ file: "freshstart-payments.csv", label: "Payments" }], expenses: [{ file: "freshstart-expenses.csv", label: "Expenses" }] },
  },
  {
    slug: "neighborhood-kitchen", name: "Neighborhood Kitchen", records: "spreadsheet", sponsor: "northstar",
    problem: "Food costs keep rising and the owner can't see which categories are driving it.",
    includes: ["6 months of expenses by vendor and category"],
    steps: ["Upload expenses", "Review expense trends", "Run an intelligence scan"],
    profile: { industry: "Restaurant", sales_tracking: "POS system", invoicing: "Not applicable", biggest_challenge: "Food costs keep going up", ai_experience: "Beginner", main_goal: "Protect profit margins" },
    answers: { records_maintainer: "General manager", reviewer: "Owner", update_frequency: "Weekly", systems: ["pos", "spreadsheets", "accounting"], financial_access: "Owner and GM", staff_tool_comfort: "medium" },
    files: { expenses: [{ file: "neighborhood-kitchen-expenses.csv", label: "Expenses" }] },
  },
  {
    slug: "summit-hvac", name: "Summit Heating & Air", records: "spreadsheet", sponsor: "northstar",
    problem: "Quotes go cold during the busy season and some commercial customers pay slowly.",
    includes: ["24 job quotes (Customer / Job Value / Quote Sent / Last Touch / Status)", "An \"On Hold\" status to clarify", "10 invoices"],
    steps: ["Upload the job quotes", "Tell the importer what \"On Hold\" means", "Upload invoices", "Run an intelligence scan"],
    profile: { industry: "HVAC and home services", sales_tracking: "Excel spreadsheets", invoicing: "Excel or Word", biggest_challenge: "Quotes go cold when we're busy", ai_experience: "Beginner", main_goal: "Win more of the jobs we quote" },
    answers: { lead_sources: "Google, referrals and repeat customers", estimate_process: "Technician quotes on site; office types it into Excel", followup_tracking: "Last Touch column, when someone remembers", manual_tasks: "Calling back quotes, chasing invoices", records_maintainer: "Office coordinator", reviewer: "Owner", update_frequency: "A few times a week", staff_tool_comfort: "medium", financial_access: "Owner and office coordinator", systems: ["spreadsheets", "email"], ...yes },
    files: { sales: [{ file: "summit-hvac-jobs.csv", label: "Job quotes" }], invoices: [{ file: "summit-hvac-invoices.csv", label: "Invoices" }] },
  },
  {
    slug: "riverside-auto", name: "Riverside Auto Care", records: "spreadsheet", sponsor: "harborline",
    problem: "Fleet accounts run up unpaid repair orders and parts costs are climbing.",
    includes: ["10 repair-order invoices for fleet accounts", "6 months of bank-export expenses (Posted / Payee / Account / Debit)"],
    steps: ["Upload repair-order invoices", "Upload the bank expense export", "Run an intelligence scan"],
    profile: { industry: "Auto repair", sales_tracking: "Shop management software", invoicing: "Shop management software", biggest_challenge: "Fleet customers pay late", ai_experience: "Some experience", main_goal: "Get paid faster and control parts costs" },
    answers: { lead_sources: "Fleet contracts and walk-ins", manual_tasks: "Calling fleet managers about balances", records_maintainer: "Service manager", reviewer: "Owner", update_frequency: "Daily", staff_tool_comfort: "high", financial_access: "Owner and bookkeeper", systems: ["accounting", "email"], ...yes },
    files: { invoices: [{ file: "riverside-auto-repair-orders.csv", label: "Repair orders" }], expenses: [{ file: "riverside-auto-expenses.csv", label: "Bank expense export" }] },
  },
  {
    slug: "beauty-lounge", name: "The Beauty Lounge", records: "manual", sponsor: "northstar",
    problem: "Weekday chairs sit empty and cancellations aren't tracked anywhere but a paper book.",
    includes: ["Paper appointment book → 5 weeks of totals to enter by hand"],
    steps: ["Onboard with paper records", "Enter weekly totals by hand (example weeks provided)", "Capacity analysis activates after 2 weeks", "Run an intelligence scan"],
    profile: { industry: "Salon", sales_tracking: "Paper appointment book", invoicing: "I don't send invoices", biggest_challenge: "Empty chairs on weekdays", ai_experience: "Beginner", main_goal: "Fill more appointment slots" },
    answers: { lead_sources: "Walk-ins and Instagram", followup_tracking: "Not tracked", records_maintainer: "Front desk", reviewer: "Owner", update_frequency: "Weekly totals on Sunday", systems: ["paper", "appointments"], staff_tool_comfort: "low", customer_permission: "unsure" },
    files: {},
    weeks: S.beautyLoungeWeeks(),
  },
  {
    slug: "iron-oak-fitness", name: "Iron & Oak Fitness", records: "manual", sponsor: "northstar",
    problem: "Class no-shows are rising and spots go unfilled; attendance is on paper sign-in sheets.",
    includes: ["Paper sign-in sheets → 6 weeks of class totals to enter by hand"],
    steps: ["Onboard with paper records", "Enter weekly class totals (example weeks provided)", "Capacity analysis activates", "Run an intelligence scan"],
    profile: { industry: "Fitness studio", sales_tracking: "Paper sign-in sheets", invoicing: "I don't send invoices", biggest_challenge: "No-shows and half-empty classes", ai_experience: "Beginner", main_goal: "Fill more class spots" },
    answers: { lead_sources: "Instagram and word of mouth", followup_tracking: "Not tracked", records_maintainer: "Head coach", reviewer: "Owner", update_frequency: "Weekly", systems: ["paper"], staff_tool_comfort: "medium", customer_permission: "unsure" },
    files: {},
    weeks: S.ironOakWeeks(),
  },
  {
    slug: "paws-claws-grooming", name: "Paws & Claws Grooming", records: "manual", sponsor: "harborline",
    problem: "Last-minute cancellations leave weekday gaps; bookings live in a paper calendar.",
    includes: ["Paper calendar → 6 weeks of booking totals to enter by hand"],
    steps: ["Onboard with paper records", "Enter weekly booking totals (example weeks provided)", "Enter cash on hand", "Run an intelligence scan"],
    profile: { industry: "Pet grooming", sales_tracking: "Paper notebook", invoicing: "I don't send invoices", biggest_challenge: "Last-minute cancellations", ai_experience: "Beginner", main_goal: "Keep the grooming tables full" },
    answers: { lead_sources: "Repeat customers and referrals", followup_tracking: "Paper calendar", records_maintainer: "Owner", reviewer: "Owner", update_frequency: "Weekly", systems: ["paper"], staff_tool_comfort: "low", customer_permission: "yes", human_approval: "yes" },
    files: {},
    weeks: S.pawsWeeks(),
  },
];

export function presetFor(slug: string | null | undefined): Preset | undefined {
  return PRESETS.find((p) => p.slug === slug);
}
