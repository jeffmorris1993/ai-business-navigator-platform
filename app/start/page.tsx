import Link from "next/link";
import { PresetGrid } from "@/components/app/preset-grid";
import { OwnBusinessForm } from "@/components/app/own-business-form";

export default function Start() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-[#fbfbfa]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-md bg-ink text-[13px] font-semibold text-white">S</span>
            <span className="text-[13.5px] font-semibold tracking-tight">Sirrom <span className="font-normal text-ink-3">Business AI Navigator</span></span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-[26px] font-semibold tracking-tight">Onboard a business</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-3">
          Pick an example company and go through the whole process as its owner: answer the onboarding questions, add their records (upload their spreadsheets or type in their paper-record totals), fix what AI Readiness finds, and run an intelligence scan. All companies and records are fictional.
        </p>
        <div className="mt-8"><PresetGrid /></div>
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">Or set up your own business</h2>
          <div className="mt-3 max-w-md"><OwnBusinessForm /></div>
        </section>
      </main>
    </div>
  );
}
