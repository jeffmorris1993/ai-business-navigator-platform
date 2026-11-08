"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/client";

export default function Start() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
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
        <h1 className="text-xl font-semibold">Set up your business</h1>
        <p className="mt-1 text-sm text-slate-500">It takes about two minutes. You can upload records afterwards.</p>
        <div className="mt-6 space-y-1.5">
          <Label htmlFor="name">Business name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Plumbing" required />
        </div>
        <Button type="submit" className="mt-6 w-full" disabled={busy || !name.trim()}>{busy ? "Creating..." : "Continue"}</Button>
        <Link href="/" className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-700">Back</Link>
      </form>
    </div>
  );
}
