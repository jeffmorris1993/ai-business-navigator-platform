import type { z } from "zod";

export type AgentName = "readiness" | "sales" | "finance" | "advisor";

export interface ToolContext {
  businessId: string; // always from the server session, never from the model
  agent: AgentName;
  approved?: boolean; // true only when the owner clicked Approve on a pending action
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
  run: (ctx: ToolContext, input: z.infer<S>) => Promise<ToolResult>;
}
