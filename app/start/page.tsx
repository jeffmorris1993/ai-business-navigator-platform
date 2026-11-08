import { PublicHeader } from "@/components/brand/public-header";
import { PresetGrid } from "@/components/app/preset-grid";
import { OwnBusinessForm } from "@/components/app/own-business-form";

export default function Start() {
  return (
    <div className="min-h-screen bg-canvas">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-4">Example companies · fictional</div>
        <h1 className="mt-3 font-display text-[40px] leading-tight tracking-[-0.02em]">Onboard a business</h1>
        <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-ink-3">
          Pick an example company and go through the whole process as its owner: answer the onboarding questions, add their records (upload their spreadsheets or type in their paper-record totals), fix what AI Readiness finds, and run an intelligence scan. All companies and records are fictional.
        </p>
        <div className="mt-10"><PresetGrid /></div>
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="font-display text-[24px] text-ink">Or set up your own business</h2>
          <div className="mt-3 max-w-md"><OwnBusinessForm /></div>
        </section>
      </main>
    </div>
  );
}
