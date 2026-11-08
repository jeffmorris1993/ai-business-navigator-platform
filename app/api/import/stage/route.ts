import { handle } from "@/lib/http";
import { requireOwner } from "@/lib/auth/session";
import { stageUpload } from "@/lib/services/imports";
import { ImportError, MAX_FILE_BYTES } from "@/lib/import/parse";

export const maxDuration = 60;

export const POST = handle(async (req: Request) => {
  const { businessId } = await requireOwner();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ImportError("Choose a file to upload.");
  if (file.size > MAX_FILE_BYTES) throw new ImportError("That file is larger than 5 MB.");
  return stageUpload(businessId, file.name, Buffer.from(await file.arrayBuffer()));
});
