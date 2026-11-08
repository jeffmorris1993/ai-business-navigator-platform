import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db, must } from "../db/client";
import * as repo from "../db/repo";
import { parseSpreadsheet, ImportError } from "../import/parse";
import { aiSuggestMapping } from "../import/ai-suggest";
import { heuristicMapping } from "../import/heuristics";
import { headerSignature, RECORD_TYPES, type RecordType } from "../import/schemas";
import { normalizeRows, validateMapping } from "../import/normalize";
import { toDbRows } from "../import/toRows";
import { runAssessment } from "../readiness/engine";
import { revalidateFindings } from "../intelligence/findings";
import type { ConfirmedMapping, MappingSuggestion } from "../import/types";
import { liveAiAvailable } from "../ai/openai";

const BUCKET = "source-files";

function safeName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-100) || "upload";
}

/** Step 1: store the original file privately, parse it, suggest a mapping. */
export async function stageUpload(businessId: string, filename: string, bytes: Buffer) {
  const parsed = await parseSpreadsheet(filename, bytes);
  if (!parsed.rows.length) throw new ImportError("I found column names but no rows of data.");
  const path = `${businessId}/${randomUUID()}-${safeName(filename)}`;
  const up = await db().storage.from(BUCKET).upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
  if (up.error) throw new Error(`Could not store the file: ${up.error.message}`);

  const signature = headerSignature(parsed.headers);
  const saved = await db().from("column_mappings").select("*").eq("business_id", businessId).eq("header_signature", signature).maybeSingle();
  let suggestion: MappingSuggestion;
  let aiError: string | null = null;
  if (saved.data) {
    const type = saved.data.record_type as RecordType;
    const base = heuristicMapping(parsed.headers, parsed.rows, type);
    const statusMap = saved.data.status_map as Record<string, string>;
    suggestion = {
      ...base,
      recordTypeReason: "You confirmed this layout on an earlier import",
      columns: parsed.headers.map((h) => ({ header: h, field: (saved.data!.mapping as Record<string, string | null>)[h] ?? null, confidence: "high", reason: "Saved from your last confirmed import" })),
      statusValues: base.statusValues.map((s) => (statusMap[s.raw] ? { raw: s.raw, suggested: statusMap[s.raw], ambiguous: false } : s)),
      suggestedBy: "saved",
    };
  } else if (liveAiAvailable()) {
    try {
      suggestion = await aiSuggestMapping(parsed.headers, parsed.rows);
    } catch (e) {
      aiError = e instanceof Error ? e.message : "AI request failed";
      suggestion = heuristicMapping(parsed.headers, parsed.rows);
    }
  } else {
    suggestion = heuristicMapping(parsed.headers, parsed.rows);
  }
  const existingOpps = suggestion.recordType === "sales_opportunity" ? (await repo.listOpportunities(businessId)).length : 0;
  const existingInvoices = suggestion.recordType === "invoice" ? (await repo.listInvoices(businessId)).length : 0;
  return {
    stagingPath: path,
    filename: parsed.filename,
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, 5).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v]))),
    rowCount: parsed.rows.length,
    truncated: parsed.truncated,
    suggestion,
    aiError,
    existingRecords: existingOpps + existingInvoices,
  };
}

/** Step 2: owner confirmed the mapping. Re-read the stored file, normalize, validate, save. */
export async function commitImport(
  businessId: string,
  stagingPath: string,
  filename: string,
  mapping: ConfirmedMapping,
  mode: "append" | "update" | "replace",
) {
  if (!stagingPath.startsWith(`${businessId}/`) || stagingPath.includes("..")) throw new ImportError("That upload doesn't belong to this business.");
  if (!RECORD_TYPES[mapping.recordType]) throw new ImportError("Unknown record type.");
  const { errors, warnings } = validateMapping(mapping);
  if (errors.length) return { ok: false as const, errors, warnings };

  const dl = await db().storage.from(BUCKET).download(stagingPath);
  if (dl.error || !dl.data) throw new ImportError("The uploaded file has expired. Please upload it again.");
  const bytes = Buffer.from(await dl.data.arrayBuffer());
  const parsed = await parseSpreadsheet(filename, bytes);
  const { records, issues } = normalizeRows(parsed.rows, mapping);

  const sf = must(
    await db().from("source_files").insert({
      business_id: businessId, filename: parsed.filename.slice(0, 200), storage_path: stagingPath,
      sha256: createHash("sha256").update(bytes).digest("hex"), record_type: mapping.recordType, row_count: records.length, import_mode: mode,
    }).select("id").single(),
    "Save source file",
  ) as { id: string };

  const table = RECORD_TYPES[mapping.recordType].table;
  const rows = toDbRows(mapping.recordType, records, businessId, sf.id) as Record<string, unknown>[];
  let inserted = 0;
  let updated = 0;

  if (mode === "replace") {
    await db().from(table).delete().eq("business_id", businessId);
  }

  if (mapping.recordType === "payment") {
    const invoices = await repo.listInvoices(businessId);
    for (const r of rows) {
      const inv = invoices.find((i) => i.invoice_no && i.invoice_no === r.__invoice_no);
      delete r.__invoice_no;
      r.invoice_id = inv?.id ?? null;
    }
    const valid = rows.filter((r) => r.amount != null && Number(r.amount) > 0 && r.paid_on);
    if (valid.length) must(await db().from("payments").insert(valid), "Save payments");
    inserted = valid.length;
  } else if (mode === "update" && (mapping.recordType === "sales_opportunity" || mapping.recordType === "invoice")) {
    const existing = mapping.recordType === "sales_opportunity" ? await repo.listOpportunities(businessId) : await repo.listInvoices(businessId);
    const keyOf = (r: Record<string, unknown>) =>
      mapping.recordType === "sales_opportunity"
        ? `${String(r.customer ?? "").trim().toLowerCase()}|${r.quoted_on ?? ""}`
        : `${String(r.invoice_no ?? "").trim().toLowerCase()}`;
    const index = new Map(existing.map((e) => [keyOf(e as unknown as Record<string, unknown>), e.id]));
    const toInsert: Record<string, unknown>[] = [];
    for (const r of rows) {
      const id = index.get(keyOf(r));
      if (id) {
        const patch = Object.fromEntries(Object.entries(r).filter(([k, v]) => v != null && !["business_id"].includes(k)));
        patch.updated_at = new Date().toISOString();
        if (mapping.recordType === "sales_opportunity") patch.last_contact_unknown = r.last_contact_unknown ?? false;
        must(await db().from(table).update(patch).eq("id", id).eq("business_id", businessId), "Update record");
        updated += 1;
      } else toInsert.push(r);
    }
    if (toInsert.length) must(await db().from(table).insert(toInsert), "Insert records");
    inserted = toInsert.length;
  } else {
    for (let i = 0; i < rows.length; i += 500) must(await db().from(table).insert(rows.slice(i, i + 500)), "Insert records");
    inserted = rows.length;
  }

  await db().from("column_mappings").upsert(
    { business_id: businessId, record_type: mapping.recordType, header_signature: headerSignature(parsed.headers), mapping: mapping.columns, status_map: mapping.statusMap, suggested_by: "owner_confirmed", confirmed_at: new Date().toISOString() },
    { onConflict: "business_id,record_type,header_signature" },
  );
  await repo.logEvent(businessId, "data_imported", { filename: parsed.filename, recordType: mapping.recordType, inserted, updated, issues: issues.length });
  const assessment = await runAssessment(businessId, `Imported ${parsed.filename}`);
  await revalidateFindings(businessId, `Imported ${parsed.filename}`);
  return { ok: true as const, sourceFileId: sf.id, inserted, updated, issues: issues.slice(0, 50), issueCount: issues.length, warnings, assessment };
}

/** Import rows without an upload (used by the seed). Same normalize/validate path. */
export async function importRowsDirect(businessId: string, filename: string, rows: Record<string, unknown>[], mapping: ConfirmedMapping, bytes: Buffer) {
  const path = `${businessId}/${randomUUID()}-${safeName(filename)}`;
  await db().storage.from(BUCKET).upload(path, bytes, { contentType: "text/csv" });
  const { records } = normalizeRows(rows, mapping);
  const sf = must(
    await db().from("source_files").insert({ business_id: businessId, filename, storage_path: path, sha256: createHash("sha256").update(bytes).digest("hex"), record_type: mapping.recordType, row_count: records.length }).select("id").single(),
    "Save source file",
  ) as { id: string };
  const dbRows = toDbRows(mapping.recordType, records, businessId, sf.id) as Record<string, unknown>[];
  if (mapping.recordType === "payment") {
    const invoices = await repo.listInvoices(businessId);
    for (const r of dbRows) {
      r.invoice_id = invoices.find((i) => i.invoice_no === r.__invoice_no)?.id ?? null;
      delete r.__invoice_no;
    }
  }
  must(await db().from(RECORD_TYPES[mapping.recordType].table).insert(dbRows), "Seed records");
  await db().from("column_mappings").upsert(
    { business_id: businessId, record_type: mapping.recordType, header_signature: headerSignature(Object.keys(rows[0])), mapping: mapping.columns, status_map: mapping.statusMap, suggested_by: "owner_confirmed" },
    { onConflict: "business_id,record_type,header_signature" },
  );
  return sf.id;
}

export async function downloadSourceFile(businessId: string, sourceFileId: string) {
  const f = await db().from("source_files").select("filename,storage_path").eq("id", sourceFileId).eq("business_id", businessId).single();
  if (f.error || !f.data?.storage_path) return null;
  const dl = await db().storage.from(BUCKET).download(f.data.storage_path);
  if (dl.error || !dl.data) return null;
  return { filename: f.data.filename as string, bytes: Buffer.from(await dl.data.arrayBuffer()) };
}
