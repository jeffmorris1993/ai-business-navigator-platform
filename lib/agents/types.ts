import type { z } from "zod";

export type AgentName = "readiness" | "sales" | "finance" | "advisor" | "orchestrator";

export interface ToolContext {
  businessId: string; // always from the server session, never from the model
  agent: AgentName;
  approved?: boolean; // true only when the owner clicked Approve on a pending action
  runId?: string; // the agent_runs row this call belongs to
  scanId?: string; // set when running inside an intelligence scan
  inScan?: boolean;
}

export interface ToolResult {
  summary: string; // one plain-English line for the activity view (from real results)
  data: unknown;
  links?: Array<{ label: string; href: string }>;
}

export interface ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  input: S;
  agents: AgentName[];
  sensitive?: boolean; // requires owner approval before it runs
  timeoutMs?: number; // override the default per-tool timeout
  run: (ctx: ToolContext, input: z.infer<S>) => Promise<ToolResult>;
}
