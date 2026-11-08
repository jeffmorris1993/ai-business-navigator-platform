import "server-only";
import { db, must } from "../db/client";
import * as repo from "../db/repo";
import { openai, aiModel, LiveAiUnavailable } from "../ai/openai";
import { demoToday } from "../calc/dates";
import { runAgentLoop, executeTool, type ModelClient, type StepRecord, type ChatMessage } from "./loop";
import { toolsFor, getTool } from "./tools";
import { systemPrompt } from "./prompts";
import type { AgentName, ToolDef } from "./types";

export function openAiModelClient(): ModelClient {
  const ai = openai();
  if (!ai) throw new LiveAiUnavailable();
  const model = aiModel();
  return {
    name: model,
    async complete(messages, tools) {
      const res = await ai.chat.completions.create({
        model,
        messages: messages as never,
        tools: tools as never,
        tool_choice: "auto",
        parallel_tool_calls: true,
      });
      const m = res.choices[0].message;
      return {
        content: m.content,
        tool_calls: (m.tool_calls ?? []).filter((c) => c.type === "function").map((c) => ({ id: c.id, type: "function" as const, function: { name: (c as { function: { name: string } }).function.name, arguments: (c as { function: { arguments: string } }).function.arguments } })),
      };
    },
  };
}

function safeJson(v: unknown) {
  if (v == null) return null;
  const str = JSON.stringify(v);
  return str.length > 50_000 ? { truncated: true, preview: str.slice(0, 2000) } : v;
}

function describePending(tool: ToolDef, input: Record<string, unknown>) {
  if (tool.name === "record_payment") return `Record a $${input.amount} payment on an invoice (paid ${input.paid_on})`;
  if (tool.name === "approve_draft") return "Approve a message draft (it will not be sent)";
  if (tool.name === "update_record") return `Change ${Object.keys((input.changes as object) ?? {}).join(", ")} on a ${String(input.record_type).replace("_", " ")}`;
  return tool.name;
}

export interface RunAgentOptions {
  businessId: string;
  agent: AgentName;
  question: string;
  conversationId?: string | null;
  onStep?: (s: StepRecord, runId: string) => void;
  model?: ModelClient;
  // Scan options
  tools?: ToolDef[];
  system?: string;
  maxIterations?: number;
  deadlineMs?: number;
  scanId?: string;
  parentRunId?: string;
  noConversation?: boolean;
}

export async function runAgent(opts: RunAgentOptions) {
  const model = opts.model ?? openAiModelClient();
  const business = await repo.getBusiness(opts.businessId);
  let conversationId = opts.conversationId ?? null;
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (opts.noConversation) {
    // scans don't use chat memory
  } else if (conversationId) {
    const c = await db().from("conversations").select("messages").eq("id", conversationId).eq("business_id", opts.businessId).maybeSingle();
    if (c.data) history = c.data.messages as typeof history;
    else conversationId = null;
  }
  if (!conversationId && !opts.noConversation) {
    const c = must(await db().from("conversations").insert({ business_id: opts.businessId }).select("id").single(), "Conversation") as { id: string };
    conversationId = c.id;
  }
  const run = must(
    await db().from("agent_runs").insert({ business_id: opts.businessId, agent: opts.agent, conversation_id: conversationId, question: opts.question.slice(0, 2000), model: model.name, scan_id: opts.scanId ?? null, parent_run_id: opts.parentRunId ?? null }).select("id").single(),
    "Agent run",
  ) as { id: string };

  try {
    const result = await runAgentLoop({
      model,
      tools: opts.tools ?? toolsFor(opts.agent),
      ctx: { businessId: opts.businessId, agent: opts.agent, runId: run.id, scanId: opts.scanId, inScan: Boolean(opts.scanId) },
      system: opts.system ?? systemPrompt(opts.agent, business, demoToday()),
      history,
      question: opts.question.slice(0, 4000),
      maxIterations: opts.maxIterations,
      deadlineMs: opts.deadlineMs,
      onStep: async (s) => {
        await db().from("agent_steps").insert({ run_id: run.id, business_id: opts.businessId, step_no: s.step_no, kind: s.kind, tool: s.tool ?? null, input: s.input ?? null, output_summary: s.output_summary.slice(0, 1000), output: safeJson(s.output), ok: s.ok, duration_ms: s.duration_ms }).then(() => {}, () => {});
        opts.onStep?.(s, run.id);
      },
      createPending: async (tool, input) => {
        const summary = describePending(tool, input as Record<string, unknown>);
        const p = must(await db().from("pending_actions").insert({ business_id: opts.businessId, tool: tool.name, input, summary }).select("id").single(), "Pending action") as { id: string };
        return { id: p.id, tool: tool.name, summary, input };
      },
    });
    if (conversationId) {
      const newHistory = [...history, { role: "user" as const, content: opts.question }, { role: "assistant" as const, content: result.answer }].slice(-20);
      await db().from("conversations").update({ messages: newHistory, updated_at: new Date().toISOString() }).eq("id", conversationId);
    }
    await db().from("agent_runs").update({ answer: result.answer, status: "completed", finished_at: new Date().toISOString() }).eq("id", run.id);
    await repo.logEvent(opts.businessId, "agent_run", { agent: opts.agent, tools: result.steps.filter((s) => s.kind === "tool_call").map((s) => s.tool) });
    return { runId: run.id, conversationId, model: model.name, ...result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent failed";
    await db().from("agent_runs").update({ status: "failed", error: msg.slice(0, 1000), finished_at: new Date().toISOString() }).eq("id", run.id);
    throw e;
  }
}

/** Owner clicked Approve or Reject on an action the agent prepared. */
export async function decidePending(businessId: string, pendingId: string, approve: boolean) {
  const p = (await db().from("pending_actions").select("*").eq("id", pendingId).eq("business_id", businessId).single()).data;
  if (!p) throw new Error("Action not found.");
  if (p.status !== "pending") throw new Error("This action was already decided.");
  if (!approve) {
    await db().from("pending_actions").update({ status: "rejected", decided_at: new Date().toISOString() }).eq("id", pendingId);
    return { status: "rejected" as const };
  }
  const tool = getTool(p.tool);
  if (!tool) throw new Error("Unknown action.");
  const out = await executeTool([tool], { businessId, agent: tool.agents.includes("advisor") ? "advisor" : tool.agents[0], approved: true }, tool.name, JSON.stringify(p.input), { createPending: async () => { throw new Error("unreachable"); } });
  await db().from("pending_actions").update({ status: out.ok ? "approved" : "pending", result: out.ok ? out.result?.data : { error: out.error }, decided_at: out.ok ? new Date().toISOString() : null }).eq("id", pendingId);
  if (!out.ok) throw new Error(out.error ?? "Action failed");
  return { status: "approved" as const, summary: out.result!.summary, data: out.result!.data };
}

export type { ChatMessage };
