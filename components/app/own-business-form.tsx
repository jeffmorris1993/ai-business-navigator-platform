"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client";

export function OwnBusinessForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/api/business", { name });
          router.push("/onboarding");
        } catch {
          setBusy(false);
        }
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name, e.g. Riverside Plumbing" aria-label="Business name" required />
      <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Creating..." : "Continue"}</Button>
    </form>
  );
}
