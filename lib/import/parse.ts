// Parse uploaded CSV/XLSX files. Uploads are untrusted: size/row/column caps,
// formulas are never evaluated (we only read cached results), and values are plain data.
import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { ParsedSheet } from "./types";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5000;
export const MAX_COLS = 50;

export class ImportError extends Error {}

function cleanHeader(h: unknown, i: number): string {
  const s = h == null ? "" : String(h).replace(/\s+/g, " ").trim().slice(0, 80);
  return s || `Column ${i + 1}`;
}

function dedupe(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n ? `${h} (${n + 1})` : h;
  });
}

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ("error" in v) return null;
    return null;
  }
  return v;
}

export async function parseSpreadsheet(filename: string, data: ArrayBuffer | Buffer): Promise<ParsedSheet> {
  const bytes = data instanceof ArrayBuffer ? Buffer.from(data) : data;
  if (bytes.byteLength > MAX_FILE_BYTES) throw new ImportError("That file is larger than 5 MB. Please upload a smaller export.");
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return parseCsv(filename, bytes.toString("utf8"));
  if (lower.endsWith(".xlsx")) return parseXlsx(filename, bytes);
  if (lower.endsWith(".xls")) throw new ImportError("Old .xls files aren't supported. In Excel, choose Save As → .xlsx or .csv.");
  throw new ImportError("Please upload a .csv or .xlsx file.");
}

export function parseCsv(filename: string, text: string): ParsedSheet {
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const all = res.data as string[][];
  if (!all.length) throw new ImportError("The file appears to be empty.");
  const headers = dedupe(all[0].slice(0, MAX_COLS).map(cleanHeader));
  const body = all.slice(1);
  const rows = body.slice(0, MAX_ROWS).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
  return { filename, headers, rows, truncated: body.length > MAX_ROWS };
}

export async function parseXlsx(filename: string, bytes: Buffer): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  try {
    // @ts-expect-error exceljs types expect older Buffer typing
    await wb.xlsx.load(bytes);
  } catch {
    throw new ImportError("I couldn't read that Excel file. Try saving it again as .xlsx or .csv.");
  }
  const ws = wb.worksheets.find((w) => w.actualRowCount > 0);
  if (!ws) throw new ImportError("The workbook has no data.");
  const headerRow = ws.getRow(1);
  const colCount = Math.min(ws.actualColumnCount || headerRow.cellCount, MAX_COLS);
  const headers = dedupe(Array.from({ length: colCount }, (_, i) => cleanHeader(cellValue(headerRow.getCell(i + 1).value), i)));
  const rows: Record<string, unknown>[] = [];
  let truncated = false;
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      return;
    }
    rows.push(Object.fromEntries(headers.map((h, i) => [h, cellValue(row.getCell(i + 1).value)])));
  });
  return { filename, headers, rows, sheetName: ws.name, truncated };
}
