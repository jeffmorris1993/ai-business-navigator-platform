// Which fictional sample files to offer in each upload spot.
export type SampleFile = { file: string; label: string };

export const SAMPLE_FILES: Record<string, { sales?: SampleFile[]; salesUpdate?: SampleFile[]; invoices?: SampleFile[]; expenses?: SampleFile[]; payments?: SampleFile[] }> = {
  "metro-roofing": {
    sales: [{ file: "metro-roofing-estimates.xlsx", label: "metro-roofing-estimates.xlsx" }],
    salesUpdate: [{ file: "metro-roofing-estimates-updated.xlsx", label: "Updated estimates (with Last Call)" }],
    invoices: [{ file: "metro-roofing-invoices.csv", label: "metro-roofing-invoices.csv" }],
  },
  "brightpath-consulting": { sales: [{ file: "brightpath-proposals.csv", label: "brightpath-proposals.csv" }], invoices: [{ file: "brightpath-invoices.csv", label: "brightpath-invoices.csv" }] },
  "freshstart-cleaning": { invoices: [{ file: "freshstart-invoices.csv", label: "freshstart-invoices.csv" }], payments: [{ file: "freshstart-payments.csv", label: "freshstart-payments.csv" }], expenses: [{ file: "freshstart-expenses.csv", label: "freshstart-expenses.csv" }] },
  "neighborhood-kitchen": { expenses: [{ file: "neighborhood-kitchen-expenses.csv", label: "neighborhood-kitchen-expenses.csv" }] },
};

export const ALL_SAMPLES: SampleFile[] = [
  { file: "metro-roofing-estimates.xlsx", label: "Metro Roofing estimates (no contact dates)" },
  { file: "metro-roofing-estimates-updated.xlsx", label: "Metro Roofing estimates (with Last Call)" },
  { file: "metro-roofing-invoices.csv", label: "Metro Roofing invoices (QuickBooks-style)" },
  { file: "brightpath-proposals.csv", label: "BrightPath proposals (different column names)" },
  { file: "brightpath-invoices.csv", label: "BrightPath invoices" },
  { file: "freshstart-invoices.csv", label: "FreshStart invoices" },
  { file: "freshstart-payments.csv", label: "FreshStart payments" },
  { file: "freshstart-expenses.csv", label: "FreshStart expenses" },
  { file: "neighborhood-kitchen-expenses.csv", label: "Neighborhood Kitchen expenses" },
  { file: "beauty-lounge-weekly-numbers.csv", label: "Beauty Lounge weekly numbers (reference)" },
];

export function samplesFor(slug: string | null, kind: "sales" | "salesUpdate" | "invoices" | "expenses" | "payments"): SampleFile[] {
  return (slug && SAMPLE_FILES[slug]?.[kind]) || [];
}
