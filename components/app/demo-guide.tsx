"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, ChevronLeft, ChevronRight, X, Minimize2, Maximize2 } from "lucide-react";
import { DEMO_STEPS } from "@/lib/demo-steps";

export const DEMO_KEY = "sirrom_demo_step";

export function DemoGuide() {
  const [step, setStep] = useState<number | null>(null);
  const [min, setMin] = useState(false);
  const path = usePathname();
  useEffect(() => {
    try {
      const v = localStorage.getItem(DEMO_KEY);
      setStep(v == null ? null : Number(v));
    } catch {}
  }, [path]);
  if (step == null || Number.isNaN(step)) return null;
  const s = DEMO_STEPS[Math.min(step, DEMO_STEPS.length - 1)];
  const go = (n: number) => {
    const v = Math.max(0, Math.min(DEMO_STEPS.length - 1, n));
    localStorage.setItem(DEMO_KEY, String(v));
    setStep(v);
  };
  const exit = () => { localStorage.removeItem(DEMO_KEY); setStep(null); };
  if (min) {
    return (
      <button onClick={() => setMin(false)} className="fixed bottom-5 left-5 z-30 flex items-center gap-2 rounded-full bg-[#0b1530] px-4 py-2.5 text-xs font-medium text-white shadow-lg lg:left-[17rem]">
        <Compass className="size-4 text-sky-300" /> Demo · Minute {s.minute} <Maximize2 className="size-3.5" />
      </button>
    );
  }
  return (
    <div className="fixed bottom-5 left-5 z-30 w-[22rem] max-w-[calc(100vw-2.5rem)] rounded-2xl bg-[#0b1530] p-4 text-white shadow-2xl animate-fade-in lg:left-[17rem]">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-300">
        <Compass className="size-4" /> Sponsor demo · Minute {s.minute} of 5
        <button onClick={() => setMin(true)} className="ml-auto rounded p-1 text-slate-400 hover:bg-white/10" aria-label="Minimize"><Minimize2 className="size-3.5" /></button>
        <button onClick={exit} className="rounded p-1 text-slate-400 hover:bg-white/10" aria-label="Exit demo"><X className="size-3.5" /></button>
      </div>
      <div className="text-base font-semibold">{s.title}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-300"><span className="font-semibold text-slate-100">Say: </span>{s.say}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-300"><span className="font-semibold text-slate-100">Do: </span>{s.do}</p>
      <div className="mt-3 flex items-center gap-1.5">
        {DEMO_STEPS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-sky-400" : "bg-white/15"}`} />)}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => go(step - 1)} disabled={step === 0} className="flex items-center gap-1 text-xs text-slate-300 disabled:opacity-30"><ChevronLeft className="size-3.5" /> Back</button>
        {path !== s.href && <Link href={s.href} className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20">Open this screen</Link>}
        {step < DEMO_STEPS.length - 1 ? (
          <Link href={DEMO_STEPS[step + 1].href} onClick={() => go(step + 1)} className="flex items-center gap-1 rounded-md bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-400">Next minute <ChevronRight className="size-3.5" /></Link>
        ) : (
          <Link href="/sponsor-access?go=1" className="flex items-center gap-1 rounded-md bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-400">Sponsor Dashboard <ChevronRight className="size-3.5" /></Link>
        )}
      </div>
    </div>
  );
}
