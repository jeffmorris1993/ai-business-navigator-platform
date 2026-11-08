"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client";

export function SignInButton({ businessId, sponsorSlug, className, children }: { businessId?: string; sponsorSlug?: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          localStorage.removeItem("sirrom_demo_step");
          if (sponsorSlug) {
            await api("/api/session", { role: "sponsor", sponsorSlug });
            router.push("/sponsor");
          } else {
            const r = await api<{ onboarded: boolean }>("/api/session", { role: "owner", businessId });
            router.push(r.onboarded ? "/overview" : "/onboarding");
          }
          router.refresh();
        } catch {
          setBusy(false);
        }
      }}
    >
      {busy ? <span className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Opening...</span> : children}
    </button>
  );
}
