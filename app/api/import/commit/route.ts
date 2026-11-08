import { handle, jsonBody } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { commitImport } from "@/lib/services/imports";
import type { ConfirmedMapping } from "@/lib/import/types";

export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const b = await jsonBody<{ stagingPath: string; filename: string; mapping: ConfirmedMapping; mode?: "append" | "update" | "replace" }>(req);
  const mode = b.mode === "update" || b.mode === "replace" ? b.mode : "append";
  return commitImport(businessId, String(b.stagingPath), String(b.filename), b.mapping, mode);
});
