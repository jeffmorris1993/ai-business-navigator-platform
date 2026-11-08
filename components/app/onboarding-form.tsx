"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client";
import type { ProfileAnswers } from "@/lib/types";

const METRO = {
  name: "Metro Roofing", industry: "Roofing and construction", sales_tracking: "Excel spreadsheets", invoicing: "QuickBooks",
  biggest_challenge: "Following up with customers", ai_experience: "Beginner", main_goal: "Increase sales without hiring another administrator",
  answers: { lead_sources: "Phone calls and website form", estimate_process: "Owner measures the roof and writes the bid in Excel", followup_tracking: "Memory and sticky notes", manual_tasks: "Calling back homeowners, chasing invoices", records_maintainer: "Owner", reviewer: "Owner", update_frequency: "Weekly", staff_tool_comfort: "medium", customer_permission: "yes", human_approval: "yes", financial_access: "Owner and bookkeeper" } as ProfileAnswers,
};

type Form = typeof METRO;

export function OnboardingForm({ initial, isMetro }: { initial: Form; isMetro: boolean }) {
  const [f, setF] = useState<Form>(initial);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const set = (k: keyof Form, v: string) => setF((x) => ({ ...x, [k]: v }));
  const setA = (k: keyof ProfileAnswers, v: string) => setF((x) => ({ ...x, answers: { ...x.answers, [k]: v || undefined } }));

  async function submit() {
    setBusy(true);
    try {
      await api("/api/onboarding", f);
      router.push("/readiness?welcome=1");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="grid size-7 place-items-center rounded-md bg-ink text-[13px] font-semibold text-white">S</div>
        <span className="font-semibold">Sirrom Business AI Navigator</span>
        <span className="ml-auto text-sm text-slate-500">Step {step} of 2</span>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm animate-fade-in">
        {step === 1 ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Tell us about your business</h1>
            <p className="mt-1 text-sm text-slate-500">A few simple questions. No technical knowledge needed.</p>
            {isMetro && (
              <button type="button" onClick={() => setF(METRO)} className="mt-4 flex w-full items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100">
                <Wand2 className="size-4" /> Use Metro Roofing&apos;s answers (demo)
              </button>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Business name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Industry"><Input value={f.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Roofing and construction" /></Field>
              <Field label="How do you keep track of sales?">
                <Select value={f.sales_tracking} onChange={(e) => set("sales_tracking", e.target.value)}>
                  <option value="">Choose one</option>
                  {["Excel spreadsheets", "Google Sheets", "CRM software", "Point-of-sale system", "Paper appointment book", "Paper notebook", "Not tracked"].map((o) => <option key={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="How do you send invoices?">
                <Select value={f.invoicing} onChange={(e) => set("invoicing", e.target.value)}>
                  <option value="">Choose one</option>
                  {["QuickBooks", "FreshBooks", "Xero", "Excel or Word", "Paper", "I don't send invoices"].map((o) => <option key={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="Biggest challenge"><Input value={f.biggest_challenge} onChange={(e) => set("biggest_challenge", e.target.value)} placeholder="e.g. Following up with customers" /></Field>
              <Field label="Experience with AI">
                <Select value={f.ai_experience} onChange={(e) => set("ai_experience", e.target.value)}>
                  <option value="">Choose one</option>
                  {["Beginner", "Some experience", "Use AI tools regularly"].map((o) => <option key={o}>{o}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2"><Field label="Main goal"><Input value={f.main_goal} onChange={(e) => set("main_goal", e.target.value)} placeholder="e.g. Increase sales without hiring another administrator" /></Field></div>
            </div>
            <div className="mt-8 flex justify-end gap-2">
              <Button variant="secondary" onClick={submit} disabled={busy || !f.name}>Skip details</Button>
              <Button onClick={() => setStep(2)} disabled={!f.name}>Next <ArrowRight /></Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">A few questions about how work gets done</h1>
            <p className="mt-1 text-sm text-slate-500">Optional. These help the AI Readiness Agent recommend what will realistically work for you. Skip anything you&apos;re unsure about.</p>
            <div className="mt-6 space-y-6">
              <Section title="How your business runs">
                <Field label="How do new leads reach you?"><Input value={f.answers.lead_sources ?? ""} onChange={(e) => setA("lead_sources", e.target.value)} /></Field>
                <Field label="How do you keep track of follow-ups?"><Input value={f.answers.followup_tracking ?? ""} onChange={(e) => setA("followup_tracking", e.target.value)} /></Field>
                <Field label="What tasks take the most manual time?"><Textarea rows={2} value={f.answers.manual_tasks ?? ""} onChange={(e) => setA("manual_tasks", e.target.value)} /></Field>
              </Section>
              <Section title="People and routines">
                <Field label="Who keeps the records up to date?"><Input value={f.answers.records_maintainer ?? ""} onChange={(e) => setA("records_maintainer", e.target.value)} /></Field>
                <Field label="Who will review AI recommendations?"><Input value={f.answers.reviewer ?? ""} onChange={(e) => setA("reviewer", e.target.value)} /></Field>
                <Field label="How often are records updated?"><Input value={f.answers.update_frequency ?? ""} onChange={(e) => setA("update_frequency", e.target.value)} placeholder="e.g. Weekly" /></Field>
              </Section>
              <Section title="Privacy and responsible use">
                <Field label="Do you have permission to contact the customers in your records?">
                  <Select value={f.answers.customer_permission ?? ""} onChange={(e) => setA("customer_permission", e.target.value)}><option value="">Not sure yet</option><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Unsure</option></Select>
                </Field>
                <Field label="Will a person approve every message before it's sent?">
                  <Select value={f.answers.human_approval ?? ""} onChange={(e) => setA("human_approval", e.target.value)}><option value="">Not sure yet</option><option value="yes">Yes</option><option value="no">No</option></Select>
                </Field>
                <Field label="Who can see your financial records?"><Input value={f.answers.financial_access ?? ""} onChange={(e) => setA("financial_access", e.target.value)} /></Field>
              </Section>
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Create my readiness report</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div><div className="space-y-3">{children}</div></div>;
}
