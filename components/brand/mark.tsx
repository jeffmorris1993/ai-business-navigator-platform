import { cn } from "@/lib/utils";

/**
 * Sirrom mark: a routed signal path (an abstract "S") connecting three nodes —
 * coordinated agents passing intelligence along. The terminal node is signal lime.
 */
export function SirromMark({ size = 28, tone = "dark", className, boxed = true }: { size?: number; tone?: "dark" | "light"; className?: string; boxed?: boolean }) {
  const stroke = tone === "dark" ? (boxed ? "#e9ebee" : "#0b0d10") : "#e9ebee";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={cn("shrink-0", className)} aria-hidden="true">
      {boxed && <rect width="32" height="32" rx="8" fill="#0e1218" />}
      {boxed && <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="#2a313c" />}
      <path d="M8.5 8.5H16.5a4.75 4.75 0 0 1 0 9.5h-1a4.75 4.75 0 0 0 0 9.5h8" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="2.4" fill={stroke} />
      <circle cx="16" cy="18" r="1.7" fill={boxed ? "#0e1218" : tone === "dark" ? "#fdfcfa" : "#0e1218"} stroke={stroke} strokeWidth="1.6" />
      <circle cx="23.5" cy="27.5" r="2.6" fill="#c8f04b" />
    </svg>
  );
}

export function Wordmark({ tone = "dark", size = "md", sub = true, className }: { tone?: "dark" | "light"; size?: "sm" | "md" | "lg"; sub?: boolean; className?: string }) {
  const s = { sm: { mark: 24, name: "text-[15px]", sub: "text-[10.5px]" }, md: { mark: 30, name: "text-[17px]", sub: "text-[11px]" }, lg: { mark: 40, name: "text-[24px]", sub: "text-[12.5px]" } }[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <SirromMark size={s.mark} tone={tone} />
      <span className="leading-none">
        <span className={cn("block font-semibold tracking-[-0.02em]", s.name, tone === "light" ? "text-night" : "text-ink")}>Sirrom</span>
        {sub && <span className={cn("mt-1 block font-mono uppercase tracking-[0.16em]", s.sub, tone === "light" ? "text-night-3" : "text-ink-4")}>Intelligence</span>}
      </span>
    </span>
  );
}
