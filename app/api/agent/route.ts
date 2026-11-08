import { requireOwner, AuthError } from "@/lib/auth/session";
import { liveAiAvailable } from "@/lib/ai/openai";
import { runAgent } from "@/lib/agents/run";
import type { AgentName } from "@/lib/agents/types";

export const maxDuration = 120;

// Streams NDJSON: {type:"step"} for each real model call / tool execution, then {type:"done"}.
export async function POST(req: Request) {
  let businessId: string;
  try {
    ({ businessId } = await requireOwner());
  } catch (e) {
    return Response.json({ error: e instanceof AuthError ? e.message : "Unauthorized" }, { status: 401 });
  }
  if (!liveAiAvailable()) return Response.json({ error: "Live AI is unavailable: no OpenAI API key is configured on the server.", code: "live_ai_unavailable" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const agent = (["readiness", "sales", "finance", "advisor"].includes(body.agent) ? body.agent : "advisor") as AgentName;
  const question = String(body.question ?? "").trim().slice(0, 2000);
  if (!question) return Response.json({ error: "Ask a question." }, { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const r = await runAgent({ businessId, agent, question, conversationId: typeof body.conversationId === "string" ? body.conversationId : null, onStep: (s) => send({ type: "step", step: { step_no: s.step_no, kind: s.kind, tool: s.tool, output_summary: s.output_summary, ok: s.ok, duration_ms: s.duration_ms } }) });
        send({ type: "done", answer: r.answer, links: r.links, pending: r.pending.map((p) => ({ id: p.id, tool: p.tool, summary: p.summary })), model: r.model, runId: r.runId, conversationId: r.conversationId });
      } catch (e) {
        console.error(e);
        send({ type: "error", error: e instanceof Error && /api key|401|quota/i.test(e.message) ? "The AI service rejected the request. Check the OpenAI API key and quota." : "The agent ran into a problem. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
