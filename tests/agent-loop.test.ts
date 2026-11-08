import { describe, it, expect } from "vitest";
import { z } from "zod";
import { runAgentLoop, executeTool, type ModelClient, type ChatMessage } from "@/lib/agents/loop";
import type { ToolDef } from "@/lib/agents/types";

// Fake model: scripted tool calls so the loop is tested deterministically (no network).
function scripted(script: Array<{ tools?: Array<[string, object]>; answer?: string }>): ModelClient & { seen: ChatMessage[][] } {
  let i = 0;
  const seen: ChatMessage[][] = [];
  return {
    name: "fake",
    seen,
    async complete(messages) {
      seen.push(messages.map((m) => ({ ...m })));
      const s = script[Math.min(i++, script.length - 1)];
      return { content: s.answer ?? null, tool_calls: (s.tools ?? []).map(([name, args], n) => ({ id: `c${i}-${n}`, type: "function" as const, function: { name, arguments: JSON.stringify(args) } })) };
    },
  };
}

const calls: string[] = [];
const tools: ToolDef[] = [
  { name: "find_stale_opportunities", description: "x", agents: ["sales", "advisor"], input: z.object({ days: z.number().int().default(7) }), run: async (_c, i) => { calls.push(`stale:${(i as { days: number }).days}`); return { summary: "Found 11", data: { count: 11, totalValue: 62000 } }; } },
  { name: "record_payment", description: "x", agents: ["finance", "advisor"], sensitive: true, input: z.object({ invoice_id: z.string(), amount: z.number().positive() }), run: async () => { calls.push("paid"); return { summary: "paid", data: {} }; } },
  { name: "boom", description: "x", agents: ["sales"], input: z.object({}), run: async () => { throw new Error("database down"); } },
];
const pendingFn = async () => ({ id: "p1", tool: "record_payment", summary: "Record payment", input: {} });

describe("agent loop", () => {
  it("executes the tool the model chose and feeds the real result back", async () => {
    calls.length = 0;
    const model = scripted([{ tools: [["find_stale_opportunities", { days: 7 }]] }, { answer: "I found 11 open estimates totaling $62,000." }]);
    const r = await runAgentLoop({ model, tools, ctx: { businessId: "b", agent: "sales" }, system: "s", history: [], question: "Which customers should I follow up with?", createPending: pendingFn });
    expect(calls).toEqual(["stale:7"]);
    expect(r.answer).toMatch(/62,000/);
    expect(r.steps.map((s) => s.kind)).toEqual(["model_call", "tool_call", "model_call"]);
    const toolMsg = model.seen[1].find((m) => m.role === "tool")!;
    expect(JSON.parse(toolMsg.content!).data.totalValue).toBe(62000);
  });

  it("blocks tools outside the agent's permissions", async () => {
    calls.length = 0;
    const model = scripted([{ tools: [["record_payment", { invoice_id: "x", amount: 5 }]] }, { answer: "ok" }]);
    const r = await runAgentLoop({ model, tools, ctx: { businessId: "b", agent: "sales" }, system: "s", history: [], question: "q", createPending: pendingFn });
    expect(calls).toEqual([]);
    expect(r.steps[1].ok).toBe(false);
    expect(r.steps[1].output_summary).toMatch(/not available to the sales agent/);
  });

  it("sensitive actions wait for approval instead of running", async () => {
    calls.length = 0;
    const model = scripted([{ tools: [["record_payment", { invoice_id: "x", amount: 50 }]] }, { answer: "Waiting for your approval." }]);
    const r = await runAgentLoop({ model, tools, ctx: { businessId: "b", agent: "finance" }, system: "s", history: [], question: "q", createPending: pendingFn });
    expect(calls).toEqual([]);
    expect(r.pending).toHaveLength(1);
    const approved = await executeTool(tools, { businessId: "b", agent: "finance", approved: true }, "record_payment", JSON.stringify({ invoice_id: "x", amount: 50 }), { createPending: pendingFn });
    expect(approved.ok).toBe(true);
    expect(calls).toEqual(["paid"]);
  });

  it("rejects invalid arguments and reports tool errors to the model", async () => {
    const model = scripted([{ tools: [["find_stale_opportunities", { days: "seven" }], ["boom", {}]] }, { answer: "Sorry" }]);
    const r = await runAgentLoop({ model, tools, ctx: { businessId: "b", agent: "sales" }, system: "s", history: [], question: "q", createPending: pendingFn });
    expect(r.steps[1].output_summary).toMatch(/Invalid arguments/);
    expect(r.steps[2].output_summary).toMatch(/database down/);
  });

  it("stops at the iteration limit", async () => {
    const model = scripted([{ tools: [["find_stale_opportunities", {}]] }]);
    const r = await runAgentLoop({ model, tools, ctx: { businessId: "b", agent: "sales" }, system: "s", history: [], question: "q", maxIterations: 3, createPending: pendingFn });
    expect(r.stoppedEarly).toBe(true);
    expect(r.steps.filter((s) => s.kind === "model_call")).toHaveLength(3);
  });

  it("includes conversation history", async () => {
    const model = scripted([{ answer: "Yes" }]);
    await runAgentLoop({ model, tools, ctx: { businessId: "b", agent: "advisor" }, system: "s", history: [{ role: "user", content: "earlier question" }, { role: "assistant", content: "earlier answer" }], question: "follow-up", createPending: pendingFn });
    expect(model.seen[0].map((m) => m.content)).toEqual(["s", "earlier question", "earlier answer", "follow-up"]);
  });
});
