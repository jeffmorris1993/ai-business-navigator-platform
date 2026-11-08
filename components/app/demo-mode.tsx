"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, RotateCcw, Play, Activity, Inbox, ListChecks, Banknote, PhoneCall, RefreshCcw, Presentation, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { GUIDE_KEY } from "./demo-guide";

export async function resetDemo(slug: string) {
  await api("/api/demo/reset", { slug });
}

export async function applySampleChange(action: "record_payment" | "contact_estimate") {
  const r = await api<{ description: string; verification?: { resolved: Array<{ title: string }>; updated: Array<{ title: string }> } }>("/api/demo/action", { action });
  const v = r.verification;
  toast.success(r.description, { description: v ? `Software re-verified findings: ${v.resolved.length} resolved, ${v.updated.length} updated.` : undefined, duration: 7000 });
  return r;
}

export function DemoModeButton({ slug, liveAi }: { slug: string; liveAi: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const go = (href: string) => { setOpen(false); router.push(href); };
  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try { await fn(); router.refresh(); } catch { /* toast shown */ } finally { setBusy(null); }
  }
  const Item = ({ n, icon: Icon, label, hint, onClick, k, disabled }: { n: number; icon: typeof Play; label: string; hint: string; onClick: () => void; k: string; disabled?: boolean }) => (
    <button onClick={onClick} disabled={Boolean(busy) || disabled} className="flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left hover:bg-subtle disabled:opacity-50">
      <span className="tnum mt-0.5 w-4 text-xs text-ink-4">{n}</span>
      {busy === k ? <Loader2 className="mt-0.5 size-4 animate-spin text-cobalt" /> : <Icon className="mt-0.5 size-4 text-ink-3" strokeWidth={1.75} />}
      <span><span className="block text-[13px] font-medium text-ink">{label}</span><span className="block text-xs text-ink-3">{hint}</span></span>
    </button>
  );
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-card hover:bg-subtle">
        <FlaskConical className="size-3.5 text-amber" /> Demo Mode
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-lg border border-line bg-surface p-1.5 shadow-pop animate-fade-in">
            <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
              <div>
                <div className="text-[13px] font-semibold">Demo Mode</div>
                <div className="text-xs text-ink-3">Real actions on fictional sample data only.</div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-ink-4 hover:bg-subtle" aria-label="Close"><X className="size-3.5" /></button>
            </div>
            <div className="border-t border-line pt-1">
              <Item n={1} k="reset" icon={RotateCcw} label="Reset demo" hint="Restore this business's records; clear findings, drafts and tasks" onClick={() => run("reset", async () => { await resetDemo(slug); toast.success("Demo reset to baseline"); go("/overview"); })} />
              <Item n={2} k="scan" icon={Play} label="Run AI Intelligence Scan" hint={liveAi ? "Agents investigate and prepare work, live" : "Live AI unavailable"} disabled={!liveAi} onClick={() => go("/overview?scan=run")} />
              <Item n={3} k="activity" icon={Activity} label="Show AI activity" hint="Every model decision and tool run" onClick={() => go("/activity")} />
              <Item n={4} k="inbox" icon={Inbox} label="Review findings" hint="Intelligence Inbox" onClick={() => go("/inbox")} />
              <Item n={5} k="actions" icon={ListChecks} label="Review prepared actions" hint="Drafts and tasks awaiting you" onClick={() => go("/actions")} />
              <div className="flex items-start gap-3 px-2.5 py-2">
                <span className="tnum mt-0.5 w-4 text-xs text-ink-4">6</span>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">Apply a sample change</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button disabled={Boolean(busy)} onClick={() => run("pay", () => applySampleChange("record_payment"))} className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-ink-2 hover:bg-subtle disabled:opacity-50">{busy === "pay" ? <Loader2 className="size-3 animate-spin" /> : <Banknote className="size-3" />} Record payment</button>
                    <button disabled={Boolean(busy)} onClick={() => run("contact", () => applySampleChange("contact_estimate"))} className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-ink-2 hover:bg-subtle disabled:opacity-50">{busy === "contact" ? <Loader2 className="size-3 animate-spin" /> : <PhoneCall className="size-3" />} Contact top estimate</button>
                  </div>
                </div>
              </div>
              <Item n={7} k="follow" icon={RefreshCcw} label="Run follow-up scan" hint="Agents re-check findings against the changed records" disabled={!liveAi} onClick={() => go("/overview?scan=followup")} />
            </div>
            <div className="mt-1 border-t border-line pt-1">
              <button onClick={() => { localStorage.setItem(GUIDE_KEY, "0"); setOpen(false); window.dispatchEvent(new Event("sirrom:guide")); }} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-subtle"><Presentation className="size-4 text-ink-3" strokeWidth={1.75} /> Start presentation guide (7 scenes)</button>
              <a href="/demo" className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-2 hover:bg-subtle"><Play className="size-4 text-ink-3" strokeWidth={1.75} /> Readiness walkthrough (from scratch)</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
