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
    <div className="space-y-6">
      {p.initial && <InitialCard r={p.initial} name={p.businessName} onUpload={() => setFix(current.find((c) => c.capability === firstUpload) ?? null)} manualHref="/data#weekly" />}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 md:col-span-2">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">AI capabilities ready to use</div>
              <div className="mt-1 text-3xl font-semibold tracking-tight">{ready.length} <span className="text-lg font-normal text-slate-400">of {current.length}</span></div>
            </div>
            <div className="flex h-2 min-w-[10rem] flex-1 overflow-hidden rounded-full bg-slate-100">
              {current.map((c) => <div key={c.capability} className={`h-full flex-1 border-r border-white transition-all ${c.status === "ready" ? "bg-emerald-500" : c.status === "partial" ? "bg-amber-400" : c.status === "needs_setup" ? "bg-rose-400" : "bg-slate-200"}`} title={`${label(c.capability)}: ${c.status}`} />)}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Before → now:</span>
            <Badge>{p.report?.readyAtStart.length ?? 0} ready at first check</Badge>
            <ArrowRight className="size-3.5 text-slate-400" />
            <Badge variant="green">{ready.length} ready today</Badge>
            {newly.map((c) => <Badge key={c.capability} variant="brand" className="animate-pop"><Sparkles className="size-3" /> New: {label(c.capability)}</Badge>)}
          </div>
        </Card>
        <Card className="flex flex-col justify-between p-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Checks run automatically</div>
            <p className="mt-1 text-sm text-slate-600">Whenever you upload data, fix records, or finish a setup task. {p.report && <>Last check {new Date(p.report.lastRun).toLocaleString()}.</>}</p>
          </div>
          <Button variant="secondary" size="sm" className="mt-3 w-fit" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api<{ changes: Change[] }>("/api/readiness/reassess"); setRecheck(r.changes); router.refresh(); } finally { setBusy(false); } }}>
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Recheck now
          </Button>
        </Card>
      </div>
      {recheck && <ChangeList changes={recheck} title="Recheck complete" />}

      {best && (
        <div className="flex flex-col gap-3 rounded-lg border border-cobalt/25 bg-cobalt-50/50 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-cobalt-700">Most valuable next step</div>
            <div className="mt-0.5 text-[14px] font-medium text-ink">{best.nextStep}</div>
            <div className="text-[12.5px] text-ink-3">Unlocks {label(best.capability)}{mightHelp.has(best.capability) ? ", which matches your goal" : ""}.</div>
          </div>
          {best.fixAction && <Button onClick={() => setFix(best)}><Wrench /> Fix This Now</Button>}
        </div>
      )}
      {GROUPS.map((g) => {
        const items = sorted.filter((c) => g.statuses.includes(c.status));
        if (!items.length) return null;
        return (
          <section key={g.title}>
            <div className="mb-3 flex items-baseline gap-2"><h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{g.title}</h2><span className="tnum text-xs text-ink-4">{items.length}</span><span className="text-[12.5px] text-ink-4">· {g.hint}</span></div>
            <div className="grid gap-4 lg:grid-cols-2">
        {items.map((c) => {
          const meta = p.capabilities.find((x) => x.key === c.capability)!;
          const isNew = newly.some((n) => n.capability === c.capability);
          return (
            <Card key={c.capability} className={`flex flex-col transition ${c.status === "ready" ? "border-emerald-200" : ""} ${isNew ? "ring-2 ring-emerald-300/60" : ""}`} data-capability={c.capability}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{meta.label}</CardTitle>
                    <CardDescription>{meta.description}</CardDescription>
                  </div>
                  <StatusPill status={c.status} className="shrink-0" />
                </div>
                {mightHelp.has(c.capability) && c.status !== "ready" && <div className="mt-1 w-fit rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">Matches your goal</div>}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {c.evidence.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Evidence from your records</div>
                    <ul className="space-y-1">{c.evidence.map((e) => <li key={e} className="flex gap-2 text-sm text-slate-700"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />{e}</li>)}</ul>
                  </div>
                )}
                {c.missing.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Missing</div>
                    <ul className="space-y-1">{c.missing.map((m) => <li key={m} className="flex gap-2 text-sm text-slate-700"><Circle className="mt-1 size-2.5 shrink-0 fill-rose-400 text-rose-400" />{m}</li>)}</ul>
                  </div>
                )}
                {c.nextStep && <p className="rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700"><span className="font-medium">Next step: </span>{c.nextStep}</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {c.fixAction && c.status !== "ready" && <Button size="sm" onClick={() => setFix(c)}><Wrench /> Fix This Now</Button>}
                  {(c.status === "ready" || c.status === "partial") && (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={meta.agent === "sales" ? (c.capability === "missed_followup" ? "/sales?analyze=1" : "/sales") : "/finance"}>
                        {c.capability === "missed_followup" ? "Analyze My Sales Opportunities" : "Open"} <ArrowRight />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
            </div>
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

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-brand-500" /> Ask the AI Readiness Agent</CardTitle><CardDescription>It runs the same readiness checks with real tools and explains them in plain English.</CardDescription></CardHeader>
        <CardContent><AgentChat agent="readiness" liveAi={p.liveAi} suggestions={["What can AI help me with?", "What's preventing me from using Financial Intelligence?", "Help me fix my spreadsheet.", "Give me a setup plan for this week."]} /></CardContent>
      </Card>

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
