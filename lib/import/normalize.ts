// Turn spreadsheet rows into standard records using a confirmed mapping.
// Ordinary code only: unknown or unparseable values become null and are reported, never guessed.
import { parseDate } from "../calc/dates";
import { parseMoney } from "../calc/money";
import { RECORD_TYPES } from "./schemas";
import type { ConfirmedMapping, RowIssue } from "./types";

export interface NormalizedRecord {
  source_row: number; // 1-based data row; header is row 1 in the sheet, so sheet row = source_row + 1
  values: Record<string, string | number | null>;
  raw: Record<string, unknown>;
}

export function normalizeRows(rows: Record<string, unknown>[], mapping: ConfirmedMapping) {
  const def = RECORD_TYPES[mapping.recordType];
  const issues: RowIssue[] = [];
  const records: NormalizedRecord[] = [];
  const fieldToHeader = new Map<string, string>();
  for (const [h, f] of Object.entries(mapping.columns)) if (f) fieldToHeader.set(f, h);

  rows.forEach((row, idx) => {
    const sourceRow = idx + 2; // matches the spreadsheet row number the owner sees
    const isBlank = Object.values(row).every((v) => v == null || String(v).trim() === "");
    if (isBlank) return;
    const values: Record<string, string | number | null> = {};
    for (const f of def.fields) {
      const header = fieldToHeader.get(f.key);
      if (!header) {
        values[f.key] = null;
        continue;
      }
      const v = row[header];
      const display = v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim();
      if (display === "") {
        values[f.key] = null;
        if (f.required) issues.push({ row: sourceRow, field: f.label, value: "", problem: "Empty" });
        continue;
      }
      if (f.kind === "money") {
        const n = parseMoney(v);
        if (n == null) issues.push({ row: sourceRow, field: f.label, value: display, problem: "Not a recognizable amount; left blank" });
        values[f.key] = n;
      } else if (f.kind === "date") {
        const d = parseDate(v);
        if (d == null && !/^(n\/?a|unknown|none|-|tbd|\?)$/i.test(display)) {
          issues.push({ row: sourceRow, field: f.label, value: display, problem: "Not a recognizable date; left blank" });
        }
        values[f.key] = d;
        if (d == null && f.key === "last_contact_on" && /^(unknown|n\/?a|\?)$/i.test(display)) values.__last_contact_unknown = 1;
      } else if (f.kind === "status") {
        const mapped = mapping.statusMap[display] ?? mapping.statusMap[display.toLowerCase()];
        if (!mapped) issues.push({ row: sourceRow, field: f.label, value: display, problem: "Status not confirmed; marked unknown" });
        values[f.key] = mapped ?? "unknown";
        values.__raw_status = display;
      } else {
        values[f.key] = display.slice(0, 500);
      }
    }
    records.push({ source_row: sourceRow, values, raw: sanitizeRaw(row) });
  });
  return { records, issues };
}

function sanitizeRaw(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row).slice(0, 60)) {
    out[k.slice(0, 100)] = v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "string" ? v.slice(0, 500) : v;
  }
  return out;
}

export function validateMapping(mapping: ConfirmedMapping): { errors: string[]; warnings: string[] } {
  const def = RECORD_TYPES[mapping.recordType];
  const errors: string[] = [];
  const warnings: string[] = [];
  const mapped = Object.values(mapping.columns).filter(Boolean) as string[];
  const dupes = mapped.filter((f, i) => mapped.indexOf(f) !== i);
  for (const d of new Set(dupes)) errors.push(`More than one column is mapped to "${def.fields.find((f) => f.key === d)?.label ?? d}".`);
  for (const f of def.fields) {
    if (f.required && !mapped.includes(f.key)) errors.push(`No column selected for "${f.label}".`);
  }
  if (mapping.recordType === "invoice") {
    if (!mapped.includes("amount_due")) {
      warnings.push(
        mapped.includes("total_amount")
          ? "Invoice total is mapped but \"Amount still owed\" isn't. A total is not the same as an unpaid balance, so overdue analysis will stay unavailable."
          : "No \"Amount still owed\" column. Overdue analysis needs unpaid balances.",
      );
    }
    if (!mapped.includes("due_on")) warnings.push("No due date column. Overdue analysis needs due dates.");
  }
  if (mapping.recordType === "sales_opportunity" && !mapped.includes("last_contact_on")) {
    warnings.push("No last contact date column. Pipeline analysis will work, but missed follow-up detection will need contact dates.");
  }
  return { errors, warnings };
}
