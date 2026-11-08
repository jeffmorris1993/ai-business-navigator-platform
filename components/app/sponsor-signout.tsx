"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";

export function SponsorSignOut() {
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button variant="night" size="sm" onClick={async () => { await api("/api/session", { role: "owner", businessSlug: "metro-roofing" }); router.push("/overview"); }}>Business view</Button>
      <Button variant="night" size="sm" onClick={async () => { await api("/api/session", undefined, "DELETE"); router.push("/"); }}>Sign out</Button>
    </div>
  );
}
