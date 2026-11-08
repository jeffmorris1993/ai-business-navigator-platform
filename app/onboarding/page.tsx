import { ownerPage } from "@/lib/page-auth";
import { getBusiness, getAnswers } from "@/lib/db/repo";
import { OnboardingForm } from "@/components/app/onboarding-form";
import { DemoGuide } from "@/components/app/demo-guide";
import { presetFor } from "@/lib/samples/presets";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const { businessId } = await ownerPage();
  const [b, a] = await Promise.all([getBusiness(businessId), getAnswers(businessId)]);
  return (
    <div className="min-h-screen px-4 py-10">
      <OnboardingForm initial={{ name: b.name, industry: b.industry ?? "", sales_tracking: b.sales_tracking ?? "", invoicing: b.invoicing ?? "", biggest_challenge: b.biggest_challenge ?? "", ai_experience: b.ai_experience ?? "", main_goal: b.main_goal ?? "", answers: a }} preset={(() => { const p = presetFor(b.slug); return p ? { name: p.name, problem: p.problem, records: p.records, steps: p.steps, profile: p.profile, answers: p.answers } : null; })()} />
      <DemoGuide />
    </div>
  );
}
