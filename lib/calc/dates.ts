// Date helpers. All business dates are plain calendar dates (YYYY-MM-DD) in UTC.

export function demoToday(): string {
  const env = process.env.DEMO_TODAY;
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env)) return env;
  return new Date().toISOString().slice(0, 10);
}

export function toUtc(d: string): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function addDays(d: string, n: number): string {
  return new Date(toUtc(d) + n * 86_400_000).toISOString().slice(0, 10);
}

export function monthKey(d: string): string {
  return d.slice(0, 7);
}

export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = toUtc(s);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function monthFromName(name: string): number | undefined {
  const k = name.toLowerCase();
  return MONTHS[k.slice(0, 4)] ?? MONTHS[k.slice(0, 3)];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function build(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const s = `${y}-${pad(m)}-${pad(d)}`;
  return isValidIsoDate(s) ? s : null;
}

/**
 * Parse a date from spreadsheet input. Returns null when unknown or unparseable
 * (we never guess). Supports ISO, US m/d/y, "Mar 5 2026", "5-Mar-26", Excel serials and Date objects.
 */
export function parseDate(input: unknown): string | null {
  if (input == null) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input.toISOString().slice(0, 10);
  }
  if (typeof input === "number") {
    // Excel serial date (days since 1899-12-30). Reasonable range only.
    if (input > 20000 && input < 80000) {
      return new Date(Date.UTC(1899, 11, 30) + Math.round(input) * 86_400_000).toISOString().slice(0, 10);
    }
    return null;
  }
  const s = String(input).trim();
  if (!s || /^(n\/?a|unknown|none|-|tbd|\?)$/i.test(s)) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return build(+m[3], +m[1], +m[2]); // US month-first
  m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{2,4})$/);
  if (m) {
    const mo = monthFromName(m[1]);
    if (mo) return build(+m[3], mo, +m[2]);
  }
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})$/);
  if (m) {
    const mo = monthFromName(m[2]);
    if (mo) return build(+m[3], mo, +m[1]);
  }
  if (/^\d{5}$/.test(s)) return parseDate(Number(s));
  return null;
}
