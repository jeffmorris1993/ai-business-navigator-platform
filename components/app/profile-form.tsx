"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { api } from "@/lib/client";
import type { ProfileAnswers } from "@/lib/types";

export function ProfileForm({ answers }: { answers: ProfileAnswers }) {
  const [a, setA] = useState<ProfileAnswers>(answers);
  const router = useRouter();
  const text: Array<[keyof ProfileAnswers, string]> = [
    ["lead_sources", "How leads reach you"], ["followup_tracking", "How follow-ups are tracked"], ["manual_tasks", "Tasks done by hand"],
    ["records_maintainer", "Who keeps records"], ["reviewer", "Who reviews AI suggestions"], ["update_frequency", "How often records are updated"], ["financial_access", "Who can see financial records"],
  ];
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await api("/api/profile", a); toast.success("Saved. Readiness re-checked."); router.refresh(); }}>
      {text.map(([k, label]) => (
        <div key={k} className="space-y-1"><Label className="text-xs">{label}</Label><Input value={(a[k] as string) ?? ""} onChange={(e) => setA({ ...a, [k]: e.target.value })} /></div>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Permission to contact customers</Label><Select value={a.customer_permission ?? ""} onChange={(e) => setA({ ...a, customer_permission: (e.target.value || undefined) as ProfileAnswers["customer_permission"] })}><option value="">Not answered</option><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Unsure</option></Select></div>
        <div className="space-y-1"><Label className="text-xs">Person approves messages</Label><Select value={a.human_approval ?? ""} onChange={(e) => setA({ ...a, human_approval: (e.target.value || undefined) as ProfileAnswers["human_approval"] })}><option value="">Not answered</option><option value="yes">Yes</option><option value="no">No</option></Select></div>
      </div>
      <Button type="submit" size="sm">Save answers</Button>
    </form>
  );
}
