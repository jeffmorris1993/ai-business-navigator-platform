// Minimal, safe markdown renderer for agent answers (no HTML injection).
import React from "react";

function inline(text: string, key: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={`${key}-${i}`} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={`${key}-${i}`} className="rounded bg-slate-100 px-1 text-[0.85em]">{p.slice(1, -1)}</code>;
    return <React.Fragment key={`${key}-${i}`}>{p}</React.Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: Array<{ text: string; sub: string[] }> } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag key={`l${out.length}`} className={list.ordered ? "ml-5 list-decimal space-y-1" : "ml-5 list-disc space-y-1"}>
        {list.items.map((it, i) => (
          <li key={i}>
            {inline(it.text, `li${out.length}-${i}`)}
            {it.sub.length > 0 && <ul className="ml-4 mt-0.5 list-[circle] space-y-0.5 text-slate-600">{it.sub.map((x, j) => <li key={j}>{inline(x, `sub${out.length}-${i}-${j}`)}</li>)}</ul>}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const indented = /^\s{2,}/.test(line) || /^\t/.test(line);
    if (ul && indented && list && list.items.length) {
      list.items[list.items.length - 1].sub.push(ul[1]);
      return;
    }
    if (ul && list?.ordered && list.items.length) {
      // Unindented bullets right after a numbered item are usually its details.
      list.items[list.items.length - 1].sub.push(ul[1]);
      return;
    }
    if (ul || ol) {
      const ordered = Boolean(ol);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push({ text: (ul ?? ol)![1], sub: [] });
      return;
    }
    flush();
    if (!line.trim()) return;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) out.push(<p key={idx} className="font-semibold text-ink">{inline(h[1], `h${idx}`)}</p>);
    else out.push(<p key={idx}>{inline(line, `p${idx}`)}</p>);
  });
  flush();
  return <div className="space-y-2 text-sm leading-relaxed text-slate-700">{out}</div>;
}
