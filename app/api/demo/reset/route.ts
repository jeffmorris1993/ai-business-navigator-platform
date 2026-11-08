import { handle, jsonBody } from "@/lib/http";
import { setSession } from "@/lib/auth/session";
import { resetSampleBusiness, type SampleSlug } from "@/lib/seed";
import { ActionError } from "@/lib/services/actions";

export const maxDuration = 60;
const SLUGS: SampleSlug[] = ["metro-roofing", "brightpath-consulting", "freshstart-cleaning", "beauty-lounge", "neighborhood-kitchen"];

// Resets one fictional sample business to its starting state and signs in as its owner.
export const POST = handle(async (req: Request) => {
  const { slug } = await jsonBody<{ slug: SampleSlug }>(req);
  if (!SLUGS.includes(slug)) throw new ActionError("Unknown sample business.");
  const id = await resetSampleBusiness(slug);
  await setSession({ role: "owner", businessId: id });
  return { ok: true };
});
