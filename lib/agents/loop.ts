// Provider-agnostic agent loop. The model chooses tools; this code validates, authorizes,
// executes and records every step. Nothing here fabricates activity: steps are logged
// only after a real model call or tool execution happens.
import { z } from "zod";
import type { ToolDef, ToolContext, ToolResult } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ModelClient {
  name: string;
  complete(messages: ChatMessage[], tools: ToolSpec[]): Promise<{ content: string | null; tool_calls: NonNullable<ChatMessage["tool_calls"]> }>;
}

export interface StepRecord {
  step_no: number;
  kind: "model_call" | "tool_call";
  tool?: string;
  input?: unknown;
  output_summary: string;
  output?: unknown;
  ok: boolean;
  duration_ms: number;
}

export interface PendingApproval {
  id: string;
  tool: string;
  summary: string;
  input: unknown;
}

export interface LoopDeps {
  model: ModelClient;
  tools: ToolDef[];
  ctx: ToolContext;
  system: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  question: string;
  maxIterations?: number;
  toolTimeoutMs?: number;
  onStep?: (s: StepRecord) => Promise<void> | void;
  deadlineMs?: number; // stop starting new model calls after this budget
  createPending: (tool: ToolDef, input: unknown) => Promise<PendingApproval>;
}

export function toolSpecs(tools: ToolDef[]): ToolSpec[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description + (t.sensitive ? " (Requires owner approval; you will receive a pending approval id.)" : ""), parameters: z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown> },
  }));
}

const MAX_TOOL_OUTPUT_CHARS = 14_000;

function withTimeout<T>(p: Promise<T>, ms: number, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${name} took too long`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Validate, authorize and run one tool call. Returns what the model sees. */
export async function executeTool(
  tools: ToolDef[],
  ctx: ToolContext,
  name: string,
  rawArgs: string,
  deps: Pick<LoopDeps, "createPending" | "toolTimeoutMs">,
): Promise<{ ok: boolean; result: ToolResult | null; error?: string; pending?: PendingApproval; input?: unknown }> {
  const tool = tools.find((t) => t.name === name);
  if (!tool || !tool.agents.includes(ctx.agent)) {
    return { ok: false, result: null, error: `Tool "${name}" is not available to the ${ctx.agent} agent.` };
  }
  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { ok: false, result: null, error: "Arguments were not valid JSON." };
  }
  const parsed = tool.input.safeParse(args);
  if (!parsed.success) {
    return { ok: false, result: null, error: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`, input: args };
  }
  if (tool.sensitive && !ctx.approved) {
    const pending = await deps.createPending(tool, parsed.data);
    return { ok: true, result: { summary: `Waiting for your approval: ${pending.summary}`, data: { requires_approval: true, pending_action_id: pending.id, message: "The owner must approve this in the app before it happens. Tell them it is waiting for approval." } }, pending, input: parsed.data };
  }
  try {
    const result = await withTimeout(tool.run(ctx, parsed.data), tool.timeoutMs ?? deps.toolTimeoutMs ?? 25_000, name);
    return { ok: true, result, input: parsed.data };
  } catch (e) {
    return { ok: false, result: null, error: e instanceof Error ? e.message : "Tool failed", input: parsed.data };
  }
}

export async function runAgentLoop(deps: LoopDeps) {
  const { model, tools, ctx } = deps;
  const specs = toolSpecs(tools);
  const messages: ChatMessage[] = [
    { role: "system", content: deps.system },
    ...deps.history.slice(-12).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: "user", content: deps.question },
  ];
  const steps: StepRecord[] = [];
  const pending: PendingApproval[] = [];
  const links = new Map<string, string>();
  const toolResults: Array<{ tool: string; data: unknown }> = [];
  let stepNo = 0;
  const record = async (s: Omit<StepRecord, "step_no">) => {
    const full = { ...s, step_no: ++stepNo };
    steps.push(full);
    await deps.onStep?.(full);
  };
  const max = deps.maxIterations ?? 8;
  const deadline = deps.deadlineMs ? Date.now() + deps.deadlineMs : null;

  for (let iter = 0; iter < max; iter++) {
    if (deadline && Date.now() > deadline) break;
    const t0 = Date.now();
    const res = await model.complete(messages, specs);
    await record({ kind: "model_call", output_summary: res.tool_calls.length ? `AI chose ${res.tool_calls.map((c) => c.function.name).join(", ")}` : "AI wrote the answer", ok: true, duration_ms: Date.now() - t0 });
    if (!res.tool_calls.length) {
      return { answer: res.content ?? "", steps, pending, links: [...links].map(([href, label]) => ({ href, label })), toolResults, iterations: iter + 1, stoppedEarly: false };
    }
    messages.push({ role: "assistant", content: res.content, tool_calls: res.tool_calls });
    // Run this turn's tool calls concurrently (e.g. several specialists at once), then record them in order.
    const started = Date.now();
    const outs = await Promise.all(res.tool_calls.map(async (call) => ({ call, out: await executeTool(tools, ctx, call.function.name, call.function.arguments, deps), ms: Date.now() - started })));
    for (const { call, out, ms } of outs) {
      const t1 = Date.now() - ms;
      if (out.pending) pending.push(out.pending);
      out.result?.links?.forEach((l) => links.set(l.href, l.label));
      if (out.result) toolResults.push({ tool: call.function.name, data: out.result.data });
      await record({
        kind: "tool_call",
        tool: call.function.name,
        input: out.input,
        output_summary: out.ok ? out.result!.summary : `Error: ${out.error}`,
        output: out.ok ? out.result!.data : { error: out.error },
        ok: out.ok,
        duration_ms: Date.now() - t1,
      });
      let content = JSON.stringify(out.ok ? { summary: out.result!.summary, data: out.result!.data } : { error: out.error });
      if (content.length > MAX_TOOL_OUTPUT_CHARS) content = content.slice(0, MAX_TOOL_OUTPUT_CHARS) + '..."(truncated)"';
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
  return {
    answer: deadline && Date.now() > deadline ? "I reached my time budget before finishing. The work recorded above was saved." : "I stopped after reaching my step limit before finishing. Here's what I completed so far; try asking a narrower question.",
    steps, pending, links: [...links].map(([href, label]) => ({ href, label })), toolResults, iterations: max, stoppedEarly: true,
  };
}
