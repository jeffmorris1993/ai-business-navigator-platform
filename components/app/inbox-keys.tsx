"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** ↑/↓ (or j/k) moves through the findings list. */
export function InboxKeys({ hrefs, current }: { hrefs: string[]; current: number }) {
  const router = useRouter();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable],[role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const d = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
      if (!d) return;
      const next = hrefs[current + d];
      if (next) { e.preventDefault(); router.replace(next, { scroll: false }); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [hrefs, current, router]);
  return null;
}
