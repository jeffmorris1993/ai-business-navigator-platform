import { ownerPage } from "@/lib/page-auth";
import { db } from "@/lib/db/client";
import { liveAiAvailable, aiModel } from "@/lib/ai/openai";
import { PageHeader } from "@/components/app/status";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AgentChat } from "@/components/app/agent-chat";
import { TOOLS } from "@/lib/agents/tools";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  const { businessId } = await ownerPage();
  const live = liveAiAvailable();
  const runs = (await db().from("agent_runs").select("id,agent,question,status,model,started_at").eq("business_id", businessId).neq("model", "simulated").order("started_at", { ascending: false }).limit(10)).data ?? [];
  const runIds = runs.map((r) => r.id);
  const steps = runIds.length ? (await db().from("agent_steps").select("run_id,tool,ok").in("run_id", runIds).eq("kind", "tool_call")).data ?? [] : [];
  return (
    <>
      <PageHeader eyebrow="Assistant" title="AI Advisor" description="One place to ask anything about your business. The Advisor picks the right readiness, sales or financial tools, uses only this business's records, and remembers this conversation." />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent className="pt-5">
            <AgentChat agent="advisor" liveAi={live} suggestions={["What can AI help me with?", "Am I ready to use the Sales Agent?", "What's preventing me from using Financial Intelligence?", "Help me fix my spreadsheet.", "Which customers should I follow up with?", "Why are my expenses increasing?", "What should I focus on this week?"]} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Recent agent runs</CardTitle><CardDescription>Logged from real model calls and tool executions.</CardDescription></CardHeader>
            <CardContent>
              {runs.length ? (
                <ul className="space-y-3 text-sm">
                  {runs.map((r) => {
                    const s = steps.filter((x) => x.run_id === r.id);
                    return (
                      <li key={r.id} className="rounded-lg bg-slate-50 p-2.5">
                        <div className="line-clamp-2 font-medium">{r.question}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500"><Badge>{r.agent}</Badge> {s.length} tool calls · {r.status} · <span className="font-mono">{r.model}</span></div>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-sm text-slate-500">No runs yet.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Tools the agents can use</CardTitle><CardDescription>{live ? `Live model: ${aiModel()}` : "Live AI unavailable"}. Sensitive tools wait for your approval.</CardDescription></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">{TOOLS.map((t) => <span key={t.name} className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${t.sensitive ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{t.name}</span>)}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
