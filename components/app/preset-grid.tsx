"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, NotebookPen, Loader2, ArrowRight, Play } from "lucide-react";
import { toast } from "sonner";
import { PRESETS, type Preset } from "@/lib/samples/presets";
import { api } from "@/lib/client";

function clearGuides() {
  try { localStorage.removeItem("sirrom_guide_scene"); localStorage.removeItem("sirrom_demo_step"); } catch {}
}

/** Example companies: onboard any of them from scratch, or open them with data already loaded. */
export function PresetGrid({ compact }: { compact?: boolean }) {
  const groups: Array<{ title: string; hint: string; Icon: typeof FileSpreadsheet; items: Preset[] }> = [
    { title: "Spreadsheet businesses", hint: "Upload their example files during onboarding", Icon: FileSpreadsheet, items: PRESETS.filter((p) => p.records === "spreadsheet") },
    { title: "Paper-records businesses", hint: "No spreadsheets: enter weekly totals by hand", Icon: NotebookPen, items: PRESETS.filter((p) => p.records === "manual") },
  ];
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.title}>
          <div className="mb-3 flex items-baseline gap-2">
            <g.Icon className="size-4 self-center text-ink-3" />
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{g.title}</h2>
            <span className="text-[12.5px] text-ink-4">· {g.hint}</span>
          </div>
          <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {g.items.map((p) => <PresetCard key={p.slug} p={p} compact={compact} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function PresetCard({ p, compact }: { p: Preset; compact?: boolean }) {
  const [busy, setBusy] = useState<"scratch" | "open" | null>(null);
  const router = useRouter();
  async function scratch() {
    setBusy("scratch");
    try {
      clearGuides();
      await api("/api/demo/reset", { slug: p.slug, scratch: true });
      router.push("/onboarding");
    } catch { setBusy(null); }
  }
  async function open() {
    setBusy("open");
    try {
      clearGuides();
      const r = await api<{ onboarded: boolean }>("/api/session", { role: "owner", businessSlug: p.slug });
      if (!r.onboarded) {
        await api("/api/demo/reset", { slug: p.slug });
        toast.success(`${p.name} restored with its example data`);
      }
      router.push("/overview");
      router.refresh();
    } catch { setBusy(null); }
  }
  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-subtle text-sm font-semibold text-ink-2 ring-1 ring-line">{p.name.slice(0, 1)}</span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold leading-tight text-ink">{p.name}</div>
          <div className="mt-0.5 text-xs text-ink-3">{p.profile.industry} · {p.records === "manual" ? `${p.profile.sales_tracking} (manual entry)` : p.profile.sales_tracking}</div>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{p.problem}</p>
      {!compact && (
        <ul className="mt-2 space-y-0.5 text-[12px] text-ink-3">
          {p.includes.map((i) => <li key={i}>· {i}</li>)}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button onClick={scratch} disabled={Boolean(busy)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-cobalt px-3 text-[13px] font-medium text-white hover:bg-cobalt-700 disabled:opacity-60">
          {busy === "scratch" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Onboard from scratch
        </button>
        <button onClick={open} disabled={Boolean(busy)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle disabled:opacity-60">
          {busy === "open" ? <Loader2 className="size-3.5 animate-spin" /> : null} Open with data <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
