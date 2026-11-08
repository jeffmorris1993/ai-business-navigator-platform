import type { RecordType } from "./schemas";

export interface MappingSuggestion {
  recordType: RecordType;
  recordTypeReason: string;
  columns: Array<{ header: string; field: string | null; confidence: "high" | "medium" | "low"; reason: string }>;
  statusValues: Array<{ raw: string; suggested: string | null; ambiguous: boolean; question?: string }>;
  questions: string[];
  suggestedBy: "ai" | "rules" | "saved";
}

export interface ConfirmedMapping {
  recordType: RecordType;
  columns: Record<string, string | null>; // header -> field key (null = keep only in raw)
  statusMap: Record<string, string>; // raw status -> standard status
}

export interface ParsedSheet {
  filename: string;
  headers: string[];
  rows: Record<string, unknown>[];
  sheetName?: string;
  truncated: boolean;
}

export interface RowIssue {
  row: number;
  field: string;
  value: string;
  problem: string;
}
