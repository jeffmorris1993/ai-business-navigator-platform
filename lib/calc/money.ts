// Money helpers. Amounts are handled in integer cents internally to avoid float drift.

export function toCents(n: number): number {
  return Math.round(n * 100);
}

export function fromCents(c: number): number {
  return c / 100;
}

export function sumMoney(values: Array<number | null | undefined>): number {
  return fromCents(values.reduce<number>((acc, v) => acc + (v == null ? 0 : toCents(v)), 0));
}

/** Parse "$1,200.50", "1200", "(300)" etc. Returns null if not a clear number. */
export function parseMoney(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) / 100 : null;
  let s = String(input).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/usd/i, "").replace(/[$\s,]/g, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (/^\d+(\.\d+)?k$/i.test(s)) {
    const v = parseFloat(s) * 1000;
    return negative ? -v : v;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const v = Math.round(parseFloat(s) * 100) / 100;
  return negative ? -v : v;
}

export function formatMoney(n: number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
}
