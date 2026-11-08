import { daysBetween, monthKey } from "./dates";
import { sumMoney } from "./money";
import type { SalesOpportunity, ManualWeek } from "../types";

export const DEFAULT_STALE_DAYS = 7;

export interface PipelineSummary {
  totalOpportunities: number;
  open: { count: number; value: number; missingAmount: number };
  won: { count: number; value: number };
  lost: { count: number; value: number };
  unknownStatus: number;
  winRateOfDecided: number | null; // historical won / (won + lost); not a prediction
}

export function calculatePipeline(opps: SalesOpportunity[]): PipelineSummary {
  const open = opps.filter((o) => o.status === "open");
  const won = opps.filter((o) => o.status === "won");
  const lost = opps.filter((o) => o.status === "lost");
  const decided = won.length + lost.length;
  return {
    totalOpportunities: opps.length,
    open: {
      count: open.length,
      value: sumMoney(open.map((o) => o.amount)),
      missingAmount: open.filter((o) => o.amount == null).length,
    },
    won: { count: won.length, value: sumMoney(won.map((o) => o.amount)) },
    lost: { count: lost.length, value: sumMoney(lost.map((o) => o.amount)) },
    unknownStatus: opps.filter((o) => o.status === "unknown").length,
    winRateOfDecided: decided ? Math.round((won.length / decided) * 1000) / 10 : null,
  };
}

export interface StaleOpportunity {
  id: string;
  customer: string | null;
  amount: number | null;
  quoted_on: string | null;
  last_contact_on: string;
  days_since_contact: number;
  priority_score: number;
  priority_reasons: string[];
  source_file_id: string | null;
  source_row: number | null;
}

export interface StaleResult {
  staleDays: number;
  asOf: string;
  stale: StaleOpportunity[];
  totalValue: number;
  openReviewed: number;
  excludedUnknownContact: Array<{ id: string; customer: string | null; amount: number | null }>;
  excludedMissingContact: Array<{ id: string; customer: string | null; amount: number | null }>;
}

/**
 * Open opportunities whose last recorded contact is more than `staleDays` days ago.
 * Opportunities with unknown or missing contact dates are excluded and reported separately
 * (we never assume when someone was last contacted).
 * Priority = value weight + urgency weight; no conversion probabilities are invented.
 */
export function findStaleOpportunities(
  opps: SalesOpportunity[],
  asOf: string,
  staleDays = DEFAULT_STALE_DAYS,
): StaleResult {
  const open = opps.filter((o) => o.status === "open");
  const stale: StaleOpportunity[] = [];
  const excludedUnknownContact: StaleResult["excludedUnknownContact"] = [];
  const excludedMissingContact: StaleResult["excludedMissingContact"] = [];
  const maxAmount = Math.max(1, ...open.map((o) => o.amount ?? 0));
  for (const o of open) {
    if (!o.last_contact_on) {
      (o.last_contact_unknown ? excludedUnknownContact : excludedMissingContact).push({
        id: o.id,
        customer: o.customer,
        amount: o.amount,
      });
      continue;
    }
    const days = daysBetween(o.last_contact_on, asOf);
    if (days <= staleDays) continue;
    const reasons: string[] = [];
    const valueScore = ((o.amount ?? 0) / maxAmount) * 60;
    const urgencyScore = Math.min(days, 45) / 45 * 40;
    if ((o.amount ?? 0) >= maxAmount * 0.6) reasons.push("one of your larger open estimates");
    if (days > 21) reasons.push(`no recorded contact in ${days} days`);
    else reasons.push(`last contact ${days} days ago`);
    if (o.amount == null) reasons.push("amount missing, value unknown");
    stale.push({
      id: o.id,
      customer: o.customer,
      amount: o.amount,
      quoted_on: o.quoted_on,
      last_contact_on: o.last_contact_on,
      days_since_contact: days,
      priority_score: Math.round(valueScore + urgencyScore),
      priority_reasons: reasons,
      source_file_id: o.source_file_id,
      source_row: o.source_row,
    });
  }
  stale.sort((a, b) => b.priority_score - a.priority_score);
  return {
    staleDays,
    asOf,
    stale,
    totalValue: sumMoney(stale.map((s) => s.amount)),
    openReviewed: open.length,
    excludedUnknownContact,
    excludedMissingContact,
  };
}

/** Open proposals quoted long ago that are still undecided. */
export function findStalledProposals(opps: SalesOpportunity[], asOf: string, olderThanDays = 30) {
  const rows = opps
    .filter((o) => o.status === "open" && o.quoted_on && daysBetween(o.quoted_on, asOf) > olderThanDays)
    .map((o) => ({ id: o.id, customer: o.customer, amount: o.amount, quoted_on: o.quoted_on, days_open: daysBetween(o.quoted_on!, asOf) }))
    .sort((a, b) => b.days_open - a.days_open);
  return { olderThanDays, count: rows.length, totalValue: sumMoney(rows.map((r) => r.amount)), proposals: rows };
}

export interface TrendPoint {
  period: string;
  won: number;
  wonValue: number;
  lost: number;
  quoted: number;
  quotedValue: number;
}

/** Monthly sales activity by quote date. Requires dated records; returns sufficiency flag. */
export function analyzeSalesTrends(opps: SalesOpportunity[]) {
  const dated = opps.filter((o) => o.quoted_on);
  const map = new Map<string, TrendPoint>();
  for (const o of dated) {
    const k = monthKey(o.quoted_on!);
    const p = map.get(k) ?? { period: k, won: 0, wonValue: 0, lost: 0, quoted: 0, quotedValue: 0 };
    p.quoted += 1;
    p.quotedValue = sumMoney([p.quotedValue, o.amount]);
    if (o.status === "won") {
      p.won += 1;
      p.wonValue = sumMoney([p.wonValue, o.amount]);
    }
    if (o.status === "lost") p.lost += 1;
    map.set(k, p);
  }
  const points = [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
  const sufficient = points.length >= 2 && dated.filter((o) => o.status === "won" || o.status === "lost").length >= 4;
  return {
    sufficient,
    reason: sufficient ? null : "Need dated won/lost records across at least two months.",
    points,
    undatedCount: opps.length - dated.length,
  };
}

/** Unused capacity from manually entered weekly numbers. No individual customers are inferred. */
export function analyzeAppointmentCapacity(weeks: ManualWeek[]) {
  const usable = weeks.filter((w) => w.unfilled_slots != null || (w.available_slots != null && w.booked != null));
  const rows = usable
    .map((w) => {
      const unfilled = w.unfilled_slots ?? Math.max(0, (w.available_slots ?? 0) - (w.booked ?? 0));
      const cancellations = w.cancellations ?? 0;
      const lostSlots = unfilled + cancellations;
      const value = w.avg_service_value != null ? sumMoney([lostSlots * w.avg_service_value]) : null;
      const capacity = w.available_slots ?? ((w.booked ?? 0) + unfilled);
      return {
        week_start: w.week_start,
        booked: w.booked,
        cancellations,
        unfilled,
        utilization: capacity ? Math.round((((w.booked ?? 0) - cancellations) / capacity) * 1000) / 10 : null,
        unused_value: value,
      };
    })
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
  const totalUnused = rows.reduce((a, r) => a + r.unfilled + r.cancellations, 0);
  const valued = rows.filter((r) => r.unused_value != null);
  return {
    weeks: rows.length,
    totalUnusedSlots: totalUnused,
    avgUnusedSlotsPerWeek: rows.length ? Math.round((totalUnused / rows.length) * 10) / 10 : null,
    estimatedUnusedValue: valued.length ? sumMoney(valued.map((r) => r.unused_value)) : null,
    avgWeeklyUnusedValue: valued.length ? Math.round(sumMoney(valued.map((r) => r.unused_value)) / valued.length) : null,
    rows,
    limitation: "Based on weekly totals you entered. Individual customers can't be identified from these numbers.",
  };
}
