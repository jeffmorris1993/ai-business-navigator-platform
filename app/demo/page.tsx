import Link from "next/link";
import { DEMO_STEPS } from "@/lib/demo-steps";
import { StartDemoButton } from "@/components/app/start-demo";

export default function Demo() {
  return (
    <div className="min-h-screen bg-[#0b1530] px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">← Sirrom Business AI Navigator</Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">The five-minute sponsor demo</h1>
        <p className="mt-2 text-slate-300">A guided walk through the real product with Metro Roofing, a fictional roofing company. Every step runs on live software: real uploads, real readiness checks, real calculations and real AI tool calls.</p>
        <ol className="mt-8 space-y-3">
          {DEMO_STEPS.map((s) => (
            <li key={s.minute} className="flex gap-4 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-500/20 text-sm font-semibold text-sky-300">{s.minute}</div>
              <div>
                <div className="font-semibold">{s.title}</div>
                <p className="mt-0.5 text-sm text-slate-400">{s.say}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-xl bg-white/5 p-4 text-sm text-slate-300 ring-1 ring-white/10">
          Starting the demo resets Metro Roofing to a blank business (fictional sample data) and signs you in as its owner. A guide in the corner tells you what to say and click at each minute.
        </div>
        <StartDemoButton />
      </div>
    </div>
  );
}
