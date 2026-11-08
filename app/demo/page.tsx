import Link from "next/link";
import { DEMO_STEPS } from "@/lib/demo-steps";
import { StartDemoButton } from "@/components/app/start-demo";

export default function Demo() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-12 text-ink">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-ink-3 hover:text-ink">← Sirrom Business AI Navigator</Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Readiness walkthrough (from scratch)</h1>
        <p className="mt-2 text-ink-3">The original onboarding story: Metro Roofing (fictional) starts with no data, uploads its estimates, AI Readiness finds missing contact dates, the owner fixes them, and each import automatically starts an intelligence scan. For the main sponsor demo, open Metro Roofing and use Demo Mode.</p>
        <ol className="mt-8 space-y-3">
          {DEMO_STEPS.map((s) => (
            <li key={s.minute} className="flex gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-cobalt-50 text-sm font-semibold text-cobalt">{s.minute}</div>
              <div>
                <div className="font-semibold">{s.title}</div>
                <p className="mt-0.5 text-sm text-ink-3">{s.say}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-xl bg-white/5 p-4 text-sm text-ink-3 ring-1 ring-white/10">
          Starting the demo resets Metro Roofing to a blank business (fictional sample data) and signs you in as its owner. A guide in the corner tells you what to say and click at each minute.
        </div>
        <StartDemoButton />
      </div>
    </div>
  );
}
