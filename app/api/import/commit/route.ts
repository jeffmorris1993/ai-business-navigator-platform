import { requireOwner, AuthError } from "@/lib/auth/session";
import { commitImport } from "@/lib/services/imports";
import { ImportError } from "@/lib/import/parse";
import { liveAiAvailable } from "@/lib/ai/openai";
import { runScan, ScanBusy } from "@/lib/intelligence/scan";
import { RECORD_TYPES } from "@/lib/import/schemas";
import { ndjson } from "@/lib/stream";
import type { ConfirmedMapping } from "@/lib/import/types";

export const maxDuration = 300;

const AREA: Record<string, string> = { sales_opportunity: "sales", appointment: "sales", invoice: "finance", payment: "finance", expense: "finance" };

// Saves the import, re-checks readiness, then (in the same request) starts an Intelligence Scan of the affected area.
// Streams NDJSON: {type:"import"} first, then scan events.
export async function POST(req: Request) {
  let businessId: string;
  try {
    ({ businessId } = await requireOwner());
  } catch (e) {
    return Response.json({ error: e instanceof AuthError ? e.message : "Unauthorized" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const mode = b.mode === "update" || b.mode === "replace" ? b.mode : "append";
  let result: Awaited<ReturnType<typeof commitImport>>;
  try {
    result = await commitImport(businessId, String(b.stagingPath), String(b.filename), b.mapping as ConfirmedMapping, mode);
  } catch (e) {
    if (e instanceof ImportError) return Response.json({ error: e.message }, { status: 400 });
    console.error(e);
    return Response.json({ error: "Import failed. Please try again." }, { status: 500 });
  }
  if (!result.ok) return Response.json(result);
  return ndjson(async (send) => {
    send({ type: "import", result });
    if (b.autoScan === false) return;
    if (!liveAiAvailable()) {
      send({ type: "scan_skipped", reason: "Live AI is unavailable, so no intelligence scan was started. Readiness was re-checked by software." });
      return;
    }
    const area = AREA[b.mapping?.recordType] ?? "sales";
    const label = RECORD_TYPES[b.mapping?.recordType as keyof typeof RECORD_TYPES]?.label.toLowerCase() ?? "records";
    try {
      await runScan({
        businessId, trigger: "import", scope: [area, "readiness"],
        scopeHint: `New ${label} were imported from "${result.inserted !== undefined ? b.filename : "a file"}" (${result.inserted} added, ${result.updated} updated). Focus on the ${area} area and on readiness changes caused by this import.`,
        onEvent: send,
      });
    } catch (e) {
      if (e instanceof ScanBusy) send({ type: "scan_skipped", reason: e.message });
    }
  });
}
