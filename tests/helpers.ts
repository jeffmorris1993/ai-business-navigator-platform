import { heuristicMapping } from "@/lib/import/heuristics";
import { normalizeRows } from "@/lib/import/normalize";
import { toDbRows } from "@/lib/import/toRows";
import type { ConfirmedMapping } from "@/lib/import/types";
import type { RecordType } from "@/lib/import/schemas";

let idc = 0;
export function importRows<T>(rows: Record<string, unknown>[], recordType?: RecordType, statusOverrides: Record<string, string> = {}): { records: T[]; mapping: ConfirmedMapping } {
  const headers = Object.keys(rows[0]);
  const s = heuristicMapping(headers, rows, recordType);
  const statusMap: Record<string, string> = {};
  for (const sv of s.statusValues) if (sv.suggested) statusMap[sv.raw] = sv.suggested;
  Object.assign(statusMap, statusOverrides);
  const mapping: ConfirmedMapping = { recordType: s.recordType, columns: Object.fromEntries(s.columns.map((c) => [c.header, c.field])), statusMap };
  const { records } = normalizeRows(rows, mapping);
  const db = toDbRows(s.recordType, records, "biz", "file") as Record<string, unknown>[];
  return { records: db.map((r) => ({ id: `id${++idc}`, ...r })) as T[], mapping };
}
