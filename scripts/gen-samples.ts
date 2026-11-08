// Writes the fictional sample spreadsheets to public/samples (downloadable from the app).
import { writeFileSync } from "node:fs";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import * as S from "../lib/samples/data";

const out = "public/samples";

function csv(name: string, rows: Record<string, unknown>[]) {
  writeFileSync(`${out}/${name}`, Papa.unparse(rows));
}

async function xlsx(name: string, rows: Record<string, unknown>[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sirrom Studios (fictional sample data)";
  const ws = wb.addWorksheet("Estimates");
  const headers = Object.keys(rows[0]);
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => r[h] ?? null));
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 18));
  await wb.xlsx.writeFile(`${out}/${name}`);
}

async function main() {
  await xlsx("metro-roofing-estimates.xlsx", S.metroEstimates(false));
  await xlsx("metro-roofing-estimates-updated.xlsx", S.metroEstimates(true));
  csv("metro-roofing-estimates.csv", S.metroEstimates(false));
  csv("metro-roofing-estimates-updated.csv", S.metroEstimates(true));
  csv("metro-roofing-invoices.csv", S.metroInvoices());
  csv("brightpath-proposals.csv", S.brightpathProposals());
  csv("brightpath-invoices.csv", S.brightpathInvoices());
  csv("freshstart-invoices.csv", S.freshstartInvoices());
  csv("freshstart-payments.csv", S.freshstartPayments());
  csv("freshstart-expenses.csv", S.freshstartExpenses());
  csv("neighborhood-kitchen-expenses.csv", S.kitchenExpenses());
  csv("beauty-lounge-weekly-numbers.csv", S.beautyLoungeWeeks());
  writeFileSync(`${out}/README.txt`, `${S.SAMPLE_NOTICE}\nAll names, businesses and amounts are invented. Reference date: 2026-11-08.\n`);
  console.log("Sample files written to", out);
}
main();
