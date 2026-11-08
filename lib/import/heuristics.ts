// Rule-based column matching. Used as a fallback when live AI is unavailable,
// and always labeled in the UI as "suggested by rules, not AI".
import { RECORD_TYPES, type RecordType, KNOWN_STATUS, AMBIGUOUS_STATUS } from "./schemas";
import type { MappingSuggestion } from "./types";
import { parseDate } from "../calc/dates";
import { parseMoney } from "../calc/money";

/** How well a column's sample values fit a field kind (1 = all fit, 0 = none). */
function valueFit(values: unknown[], kind: string): number {
  const vals = values.filter((v) => v != null && String(v).trim() !== "");
  if (!vals.length) return 0.5;
  const fits = vals.filter((v) => {
    if (kind === "date") return parseDate(v) != null;
    if (kind === "money") return parseMoney(v) != null && parseDate(v) == null;
    if (kind === "text") return true;
    return true;
  }).length;
  return fits / vals.length;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim();

function scoreHeader(header: string, synonyms: string[]): number {
  const h = norm(header);
  let best = 0;
  for (const syn of synonyms) {
    const s = norm(syn);
    if (h === s) best = Math.max(best, 1);
    else if (h.includes(s) || s.includes(h)) best = Math.max(best, 0.6 + Math.min(s.length, h.length) / Math.max(s.length, h.length) * 0.3);
  }
  return best;
}

export function guessRecordType(headers: string[]): RecordType {
  let bestType: RecordType = "sales_opportunity";
  let bestScore = -1;
  for (const [type, def] of Object.entries(RECORD_TYPES) as [RecordType, (typeof RECORD_TYPES)[RecordType]][]) {
    let score = 0;
    for (const f of def.fields) score += Math.max(...headers.map((h) => scoreHeader(h, f.synonyms)), 0) * (f.required ? 1.5 : 1);
    const lower = headers.map(norm).join(" ");
    if (type === "invoice" && /due|invoice|balance/.test(lower)) score += 2;
    if (type === "sales_opportunity" && /bid|quote|proposal|stage|result|homeowner/.test(lower)) score += 2;
    if (type === "expense" && /vendor|category|expense|payee/.test(lower)) score += 2;
    if (type === "appointment" && /appointment|service|stylist/.test(lower)) score += 2;
    if (type === "payment" && /paid|payment|received/.test(lower) && !/due/.test(lower)) score += 1.5;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }
  return bestType;
}

export function heuristicMapping(headers: string[], sampleRows: Record<string, unknown>[], recordType?: RecordType): MappingSuggestion {
  const type = recordType ?? guessRecordType(headers);
  const def = RECORD_TYPES[type];
  const used = new Set<string>();
  const columns: MappingSuggestion["columns"] = [];
  // Assign best header per field greedily by score.
  const pairs: Array<{ header: string; field: string; score: number }> = [];
  for (const h of headers) {
    const samples = sampleRows.slice(0, 20).map((r) => r[h]);
    for (const f of def.fields) {
      const name = scoreHeader(h, f.synonyms);
      const fit = valueFit(samples, f.kind);
      // Name similarity matters most, but values that clearly don't fit (a date in an amount field) disqualify.
      pairs.push({ header: h, field: f.key, score: fit < 0.5 ? name * 0.4 : name * (0.8 + 0.2 * fit) });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const assigned = new Map<string, { field: string; score: number }>();
  for (const p of pairs) {
    if (p.score < 0.5 || used.has(p.field) || assigned.has(p.header)) continue;
    assigned.set(p.header, { field: p.field, score: p.score });
    used.add(p.field);
  }
  for (const h of headers) {
    const a = assigned.get(h);
    columns.push({
      header: h,
      field: a?.field ?? null,
      confidence: a ? (a.score >= 0.95 ? "high" : "medium") : "low",
      reason: a ? `Column name resembles "${def.fields.find((f) => f.key === a.field)!.label}"` : "No matching standard field; will be kept in the original data",
    });
  }
  const statusCol = columns.find((c) => c.field === "status")?.header;
  return {
    recordType: type,
    recordTypeReason: `Column names look like ${def.label.toLowerCase()}`,
    columns,
    statusValues: statusCol ? suggestStatuses(type, sampleRows.map((r) => r[statusCol])) : [],
    questions: [],
    suggestedBy: "rules",
  };
}

export function suggestStatuses(type: RecordType, values: unknown[]): MappingSuggestion["statusValues"] {
  const known = KNOWN_STATUS[type] ?? {};
  const distinct = [...new Set(values.map((v) => (v == null ? "" : String(v).trim())).filter(Boolean))];
  return distinct.map((raw) => {
    const k = raw.toLowerCase();
    if (AMBIGUOUS_STATUS.has(k)) {
      return { raw, suggested: null, ambiguous: true, question: `What does "${raw}" mean in your records?` };
    }
    const s = known[k];
    return s ? { raw, suggested: s, ambiguous: false } : { raw, suggested: null, ambiguous: true, question: `I don't recognize "${raw}". What does it mean?` };
  });
}
