"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Presentation, ChevronLeft, ChevronRight, X, Minimize2, Loader2 } from "lucide-react";
import { SCENES, DEMO_STEPS } from "@/lib/demo-steps";
import { api } from "@/lib/client";
import { toast } from "sonner";

export const GUIDE_KEY = "sirrom_guide_scene";
export const LEGACY_KEY = "sirrom_demo_step";

type Mode = { kind: "scenes"; i: number } | { kind: "legacy"; i: number } | null;

function read(): Mode {
  try {
    const s = localStorage.getItem(GUIDE_KEY);
    if (s != null) return { kind: "scenes", i: Number(s) };
    const l = localStorage.getItem(LEGACY_KEY);
    if (l != null) return { kind: "legacy", i: Number(l) };
  } catch {}
  return null;
}

/** Floating presenter notes for the 7-scene sponsor demo (and the original readiness walkthrough). */
export function PresentationGuide() {
  const [mode, setMode] = useState<Mode>(null);
  const [min, setMin] = useState(false);
  const [busy, setBusy] = useState(false);
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    setMode(read());
    const h = () => { setMode(read()); setMin(false); };
    window.addEventListener("sirrom:guide", h);
    return () => window.removeEventListener("sirrom:guide", h);
  }, [path]);
  if (!mode || Number.isNaN(mode.i)) return null;

  const legacy = mode.kind === "legacy";
  const total = legacy ? DEMO_STEPS.length : SCENES.length;
  const i = Math.max(0, Math.min(total - 1, mode.i));
  const step = legacy ? { n: DEMO_STEPS[i].minute, title: DEMO_STEPS[i].title, href: DEMO_STEPS[i].href, say: DEMO_STEPS[i].say, do: DEMO_STEPS[i].do, action: undefined } : SCENES[i];
  const key = legacy ? LEGACY_KEY : GUIDE_KEY;
  const go = (n: number) => { const v = Math.max(0, Math.min(total - 1, n)); localStorage.setItem(key, String(v)); setMode({ kind: mode.kind, i: v }); };
  const exit = () => { localStorage.removeItem(GUIDE_KEY); localStorage.removeItem(LEGACY_KEY); setMode(null); };

  async function runAction() {
    if (!step.action) return;
    setBusy(true);
    try {
      if (step.action.kind === "reset") { await api("/api/demo/reset", { slug: "metro-roofing" }); toast.success("Metro Roofing reset to baseline"); router.push("/overview"); router.refresh(); }
      if (step.action.kind === "scan") router.push("/overview?scan=run");
      if (step.action.kind === "follow_up") router.push("/overview?scan=followup");
      if (step.action.kind === "payment") {
        const r = await api<{ description: string }>("/api/demo/action", { action: "record_payment" });
        toast.success(r.description);
        router.refresh();
      }
    } catch { /* toast shown */ } finally { setBusy(false); }
  }

  if (min) {
    return (
      <button onClick={() => setMin(false)} className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-xs font-medium text-white shadow-pop lg:left-64">
        <Presentation className="size-3.5" /> Scene {step.n} of {total}
      </button>
    );
  }
  return (
    <div className="fixed bottom-4 left-4 z-30 w-[21rem] max-w-[calc(100vw-2rem)] rounded-lg bg-ink p-4 text-white shadow-pop animate-fade-in lg:left-64">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/50">
        <Presentation className="size-3.5" /> {legacy ? `Readiness walkthrough · ${step.n}/5` : `Presentation · Scene ${step.n}/7`}
        <button onClick={() => setMin(true)} className="ml-auto rounded p-1 hover:bg-white/10" aria-label="Minimize"><Minimize2 className="size-3.5" /></button>
        <button onClick={exit} className="rounded p-1 hover:bg-white/10" aria-label="Exit guide"><X className="size-3.5" /></button>
      </div>
      <div className="text-[15px] font-semibold tracking-tight">{step.title}</div>
      <p className="mt-2 text-xs leading-relaxed text-white/70"><span className="font-medium text-white">Say </span>{step.say}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-white/70"><span className="font-medium text-white">Do </span>{step.do}</p>
      <div className="mt-3 flex gap-1">{Array.from({ length: total }, (_, n) => <div key={n} className={`h-0.5 flex-1 rounded-full ${n <= i ? "bg-white" : "bg-white/15"}`} />)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button onClick={() => go(i - 1)} disabled={i === 0} className="flex items-center gap-0.5 rounded px-1.5 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="size-3.5" />Back</button>
        {path !== step.href && <Link href={step.href} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/15">Open screen</Link>}
        {step.action && <button onClick={runAction} disabled={busy} className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/15">{busy && <Loader2 className="size-3 animate-spin" />}{step.action.label}</button>}
        <div className="ml-auto">
          {i < total - 1 ? (
            <Link href={(legacy ? DEMO_STEPS[i + 1].href : SCENES[i + 1].href)} onClick={() => go(i + 1)} className="flex items-center gap-0.5 rounded bg-cobalt px-2 py-1 text-xs font-medium hover:bg-cobalt-700">Next <ChevronRight className="size-3.5" /></Link>
          ) : (
            <button onClick={exit} className="rounded bg-cobalt px-2 py-1 text-xs font-medium hover:bg-cobalt-700">Finish</button>
          )}
        </div>
      </div>
    </div>
  );
}

export const DemoGuide = PresentationGuide;
export const DEMO_KEY = LEGACY_KEY;
