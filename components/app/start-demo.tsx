"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { api } from "@/lib/client";

export function StartDemoButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/demo/reset", { slug: "metro-roofing", scratch: true });
          localStorage.setItem("sirrom_demo_step", "0");
          router.push("/onboarding");
        } catch {
          setBusy(false);
        }
      }}
      className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-6 py-3 font-semibold hover:bg-sky-400 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {busy ? "Preparing Metro Roofing..." : "Start the demo"}
    </button>
  );
}
