import { AgentGlyph } from "./status";

/** Branded container for an agent conversation: midnight header, pearl body. */
export function AgentPanel({ agent, title, description, children, id }: { agent: string; title: string; description: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="overflow-hidden rounded-panel border border-line bg-surface shadow-card">
      <header className="on-dark flex items-center gap-3.5 bg-midnight px-6 py-4">
        <AgentGlyph agent={agent} size={34} onDark />
        <div className="min-w-0">
          <h2 className="font-display text-[20px] leading-tight text-white">{title}</h2>
          <p className="mt-0.5 text-[13px] text-night-2">{description}</p>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 text-[12px] text-night-3 sm:flex"><span className="size-1.5 rounded-full bg-teal" />Live tools · every step shown</span>
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
