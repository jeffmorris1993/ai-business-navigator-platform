"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle, Wrench, ArrowRight, RefreshCw, History, Sparkles, ClipboardList, Eye, HelpCircle, Lightbulb, Target, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "./status";
import { FixDialog, type FixProps } from "./fix-dialog";
import { AgentChat } from "./agent-chat";
import { AgentPanel } from "./agent-panel";
import { api } from "@/lib/client";
import type { CapabilityResult, CapabilityKey, AreaSummary } from "@/lib/readiness/rules";
import type { InitialReport } from "@/lib/readiness/initial";
import type { Change } from "./change-list";
import { ChangeList } from "./change-list";

interface Report {
  current: CapabilityResult[];
  readyAtStart: CapabilityKey[];
  timeline: Array<{ run_at: string; trigger: string; changes: Change[] }>;
  areas: AreaSummary[];
  lastRun: string;
  assessments: number;
}

export function ReadinessView(p: Omit<FixProps, "fix" | "onClose"> & {
  welcome: boolean; businessName: string; capabilities: Array<{ key: CapabilityKey; label: string; agent: string; description: string }>;
  report: Report | null; initial: InitialReport | null; initialAlways: InitialReport; liveAi: boolean;
}) {
  const [fix, setFix] = useState<CapabilityResult | null>(null);
  const [recheck, setRecheck] = useState<Change[] | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const current = p.report?.current ?? [];
  const ready = current.filter((c) => c.status === "ready");
  const rankS = { partial: 0, needs_setup: 1, not_assessed: 2, ready: 3 } as const;
  const best = [...current].filter((c) => c.status !== "ready" && c.fixAction && c.nextStep && !(c.status === "not_assessed" && !mightHelpKeys(p.initialAlways).has(c.capability)))
    .sort((a, b) => Number(mightHelpKeys(p.initialAlways).has(b.capability)) - Number(mightHelpKeys(p.initialAlways).has(a.capability)) || rankS[a.status] - rankS[b.status])[0];
  const newly = ready.filter((c) => !p.report?.readyAtStart.includes(c.capability));
  const label = (k: string) => p.capabilities.find((c) => c.key === k)?.label ?? k;
  const mightHelp = new Set(p.initialAlways.mightHelp.map((m) => m.capability));
  const firstUpload: CapabilityKey = p.samples.sales.length || !(p.samples.invoices.length || p.samples.expenses.length) ? (p.initial?.next.includes("invoices or expenses") ? "overdue_invoices" : "sales_pipeline") : p.samples.invoices.length ? "overdue_invoices" : "expense_trends";
  const GROUPS = [
    { title: "Ready to use", hint: "verified from your records", statuses: ["ready"] },
    { title: "One step away", hint: "some analysis works; one fix unlocks the rest", statuses: ["partial"] },
    { title: "Needs setup", hint: "information or answers are missing", statuses: ["needs_setup", "not_assessed"] },
  ];
  const sorted = [...current].sort((a, b) => Number(mightHelp.has(b.capability)) - Number(mightHelp.has(a.capability)));

  return (
    <div className="space-y-10">
      {p.initial && <InitialCard r={p.initial} name={p.businessName} onUpload={() => setFix(current.find((c) => c.capability === firstUpload) ?? null)} manualHref="/data#weekly" />}

      {/* Activation track */}
      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[12.5px] font-medium text-ink-3">AI capabilities ready to use</div>
            <div className="tnum mt-2 text-[52px] font-semibold leading-none tracking-[-0.04em] text-ink">{ready.length}<span className="text-[24px] font-normal text-ink-4"> / {current.length}</span></div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              <span>{p.report?.readyAtStart.length ?? 0} at first check</span><ArrowRight className="size-3.5 text-ink-4" /><span className="font-medium text-teal-700">{ready.length} today</span>
              {newly.map((c) => <span key={c.capability} className="inline-flex items-center gap-1 rounded-full bg-lime-50 px-2 py-0.5 text-[12px] font-medium text-ink ring-1 ring-lime-dim/40 animate-pop"><Sparkles className="size-3" /> New: {label(c.capability)}</span>)}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <p className="max-w-xs text-[12.5px] text-ink-3 lg:text-right">Checks run automatically when you upload data, fix records, or finish a setup task.{p.report && <> Last check {new Date(p.report.lastRun).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.</>}</p>
            <Button variant="secondary" size="sm" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api<{ changes: Change[] }>("/api/readiness/reassess"); setRecheck(r.changes); router.refresh(); } finally { setBusy(false); } }}>
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Recheck now
            </Button>
          </div>
        </div>
        <ol className="grid grid-cols-2 border-t border-line sm:grid-cols-4 xl:grid-cols-8" aria-label="Capability activation">
          {current.map((c, i) => {
            const st = c.status;
            return (
              <li key={c.capability} className={`relative border-line px-4 py-4 ${i % 2 ? "" : "border-r"} sm:border-r xl:[&:nth-child(8)]:border-r-0`} title={`${label(c.capability)}: ${st}`}>
                <span className={`absolute inset-x-0 top-0 h-[3px] ${st === "ready" ? "bg-teal" : st === "partial" ? "bg-amber" : st === "needs_setup" ? "bg-red/70" : "bg-line-strong"}`} />
                <span className={`grid size-6 place-items-center rounded-full ${st === "ready" ? "bg-teal text-white" : st === "partial" ? "bg-amber/15 text-amber-700" : "bg-subtle text-ink-4"}`}>{st === "ready" ? <Check className="size-3.5" /> : <span className="tnum text-[11px] font-medium">{i + 1}</span>}</span>
                <div className="mt-2 text-[12.5px] font-medium leading-snug text-ink">{label(c.capability)}</div>
                <div className={`mt-0.5 text-[11.5px] ${st === "ready" ? "text-teal-700" : st === "partial" ? "text-amber-700" : "text-ink-3"}`}>{st === "ready" ? "Active" : st === "partial" ? "One step away" : st === "needs_setup" ? "Needs setup" : "Not assessed"}</div>
              </li>
            );
          })}
        </ol>
      </section>
      {recheck && <ChangeList changes={recheck} title="Recheck complete" />}

      {best && (
        <div className="on-dark flex flex-col gap-4 rounded-panel bg-midnight px-6 py-5 text-night sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime/15 text-lime"><Target className="size-5" /></span>
          <div className="flex-1">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-night-3">Most valuable next step</div>
            <div className="mt-1 font-display text-[20px] leading-snug text-white">{best.nextStep}</div>
            <div className="mt-0.5 text-[13px] text-night-2">Unlocks {label(best.capability)}{mightHelp.has(best.capability) ? ", which matches your goal" : ""}.</div>
          </div>
          {best.fixAction && <Button variant="signal" size="lg" onClick={() => setFix(best)}><Wrench /> Fix This Now</Button>}
        </div>
      )}
      {GROUPS.map((g) => {
        const items = sorted.filter((c) => g.statuses.includes(c.status));
        if (!items.length) return null;
        return (
          <section key={g.title}>
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="font-display text-[22px] tracking-[-0.01em] text-ink">{g.title}</h2><span className="tnum text-[13px] text-ink-4">{items.length}</span><span className="text-[13px] text-ink-3">{g.hint}</span></div>
            <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface shadow-card">
        {items.map((c) => {
          const meta = p.capabilities.find((x) => x.key === c.capability)!;
          const isNew = newly.some((n) => n.capability === c.capability);
          return (
            <li key={c.capability} className={`grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] ${isNew ? "bg-lime-50/60" : ""}`} data-capability={c.capability}>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-[15.5px] font-medium text-ink">{meta.label}</h3>
                  <StatusPill status={c.status} className="shrink-0" />
                </div>
                <p className="mt-1 text-[13.5px] text-ink-3">{meta.description}</p>
                {mightHelp.has(c.capability) && c.status !== "ready" && <div className="mt-2 w-fit rounded-[5px] bg-cobalt-50 px-1.5 py-0.5 text-[11.5px] font-medium text-cobalt-700">Matches your goal</div>}
              </div>
              <div className="space-y-3">
                {c.evidence.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[12px] font-medium text-ink-3">Evidence from your records</div>
                    <ul className="space-y-1">{c.evidence.map((e) => <li key={e} className="flex gap-2 text-[13.5px] text-ink-2"><Check className="mt-0.5 size-3.5 shrink-0 text-teal" />{e}</li>)}</ul>
                  </div>
                )}
                {c.missing.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[12px] font-medium text-ink-3">Missing</div>
                    <ul className="space-y-1">{c.missing.map((m) => <li key={m} className="flex gap-2 text-[13.5px] text-ink-2"><Circle className="mt-1 size-2.5 shrink-0 fill-red/70 text-red/70" />{m}</li>)}</ul>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {c.nextStep && <p className="text-[13.5px] leading-relaxed text-ink-2"><span className="text-ink-3">Next step · </span>{c.nextStep}</p>}
                <div className="mt-auto flex flex-wrap gap-2">
                  {c.fixAction && c.status !== "ready" && <Button size="sm" onClick={() => setFix(c)}><Wrench /> Fix This Now</Button>}
                  {(c.status === "ready" || c.status === "partial") && (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={meta.agent === "sales" ? (c.capability === "missed_followup" ? "/sales?analyze=1" : "/sales") : "/finance"}>
                        {c.capability === "missed_followup" ? "Analyze My Sales Opportunities" : "Open"} <ArrowRight />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
            </ul>
          </section>
        );
      })}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-4 text-slate-400" /> Readiness history</CardTitle><CardDescription>Every change, and why it happened.</CardDescription></CardHeader>
          <CardContent>
            {p.report?.timeline.length ? (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                {p.report.timeline.slice(0, 8).map((t) => (
                  <li key={t.run_at} className="relative">
                    <span className="absolute -left-[26px] top-1 size-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                    <div className="text-xs text-slate-500">{new Date(t.run_at).toLocaleString()} · {t.trigger}</div>
                    <ul className="mt-1 space-y-1">
                      {t.changes.map((c) => (
                        <li key={c.capability} className="flex flex-wrap items-center gap-1.5 text-sm">
                          <span className="font-medium">{c.label}</span>
                          {c.from ? <><StatusPill status={c.from} className="py-0.5" /><ArrowRight className="size-3 text-slate-400" /></> : null}
                          <StatusPill status={c.to} className="py-0.5" />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-slate-500">History appears after your first check.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>The five readiness areas</CardTitle><CardDescription>What we know from your answers and records, and what isn&apos;t verified.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {p.report?.areas.map((a) => (
              <details key={a.area} className="group rounded-lg border border-slate-200 p-3">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                  {a.label}
                  <span className="flex gap-1.5 text-xs font-normal">
                    {a.known.length > 0 && <Badge variant="green">{a.known.length} known</Badge>}
                    {a.notVerified.length > 0 && <Badge>{a.notVerified.length} not verified</Badge>}
                    {a.concerns.length > 0 && <Badge variant="amber">{a.concerns.length} to fix</Badge>}
                  </span>
                </summary>
                <div className="mt-2 space-y-1 text-sm">
                  {a.known.map((k) => <div key={k} className="flex gap-2 text-slate-700"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />{k}</div>)}
                  {a.concerns.map((k) => <div key={k} className="flex gap-2 text-amber-800"><Circle className="mt-1 size-2.5 shrink-0 fill-amber-400 text-amber-400" />{k}</div>)}
                  {a.notVerified.map((k) => <div key={k} className="flex gap-2 text-slate-500"><HelpCircle className="mt-0.5 size-3.5 shrink-0" />{k}</div>)}
                </div>
              </details>
            ))}
            <Button variant="link" size="sm" asChild><Link href="/data#profile">Update your answers</Link></Button>
          </CardContent>
        </Card>
      </div>

      <AgentPanel agent="readiness" title="Ask the AI Readiness Agent" description="Runs the same readiness checks with real tools and explains them in plain English.">
        <AgentChat agent="readiness" liveAi={p.liveAi} suggestions={["What can AI help me with?", "What's preventing me from using Financial Intelligence?", "Help me fix my spreadsheet.", "Give me a setup plan for this week."]} />
      </AgentPanel>

      {fix && <FixDialog fix={fix} onClose={() => setFix(null)} openMissing={p.openMissing} unknownStatuses={p.unknownStatuses} answers={p.answers} samples={p.samples} weeks={p.weeks} />}
    </div>
  );
}

function mightHelpKeys(r: InitialReport) {
  return new Set(r.mightHelp.map((m) => m.capability));
}

function InitialCard({ r, name, onUpload, manualHref }: { r: InitialReport; name: string; onUpload: () => void; manualHref: string }) {
  const cols = [
    { Icon: ClipboardList, title: "What you already have", items: r.has, tone: "text-emerald-600" },
    { Icon: Eye, title: "Not yet verified", items: r.notVerified, tone: "text-slate-500" },
    { Icon: Target, title: "Missing", items: r.missing, tone: "text-rose-500" },
  ];
  const manual = r.next.startsWith("Enter");
  return (
    <Card className="overflow-hidden border-brand-200 animate-fade-in">
      <div className="border-b border-line bg-subtle px-5 py-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">Initial AI readiness report</div>
        <div className="mt-0.5 text-lg font-semibold text-ink">Here&apos;s what I can tell about {name} so far</div>
        <p className="mt-1 text-sm text-ink-3">This is based only on your answers. I haven&apos;t seen your records yet, so I&apos;m not marking anything as ready.</p>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-3">
        {cols.map(({ Icon, title, items, tone }) => (
          <div key={title}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon className={`size-4 ${tone}`} /> {title}</div>
            <ul className="space-y-1.5 text-sm text-slate-700">{items.length ? items.map((i) => <li key={i}>• {i}</li>) : <li className="text-slate-400">Nothing yet</li>}</ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Lightbulb className="size-4 text-amber-500" /> AI capabilities that might help</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {r.mightHelp.map((m) => <div key={m.capability} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="font-medium">{m.label}</div><div className="mt-0.5 text-xs text-slate-600">{m.why}</div></div>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-50 p-3">
          <div className="text-sm"><span className="font-semibold text-brand-900">Next step: </span><span className="text-brand-900">{r.next}</span></div>
          {manual ? <Button asChild size="sm"><Link href={manualHref}>Enter weekly numbers</Link></Button> : <Button size="sm" onClick={onUpload}>Upload my spreadsheet</Button>}
        </div>
      </div>
    </Card>
  );
}
