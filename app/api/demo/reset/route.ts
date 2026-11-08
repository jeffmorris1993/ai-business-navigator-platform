import { handle, jsonBody } from "@/lib/http";
import { setSession } from "@/lib/auth/session";
import { resetSampleBusiness, type SampleSlug } from "@/lib/seed";
import { ActionError } from "@/lib/services/actions";
import { PRESETS } from "@/lib/samples/presets";

export const maxDuration = 60;
const SLUGS = PRESETS.map((p) => p.slug) as SampleSlug[];

// Resets one fictional sample business to its starting state and signs in as its owner.
export const POST = handle(async (req: Request) => {
  const { slug, scratch } = await jsonBody<{ slug: SampleSlug; scratch?: boolean }>(req);
  if (!SLUGS.includes(slug)) throw new ActionError("Unknown sample business.");
  const id = await resetSampleBusiness(slug, { scratch: Boolean(scratch) });
  await setSession({ role: "owner", businessId: id });
  return { ok: true, scratch: Boolean(scratch) };
});
