"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line, AreaChart, Area } from "recharts";

const money = (v: number) => (v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${v}`);
const monthLabel = (m: string) => new Date(`${m}-15`).toLocaleString("en-US", { month: "short" });
const axis = { fontSize: 11, fill: "#73766e" };
const grid = "#e9eae5";
const PALETTE = ["#315cf5", "#0e8f79", "#d69a38", "#7c8a9e", "#b7bbb1", "#4b5563", "#9db3fa", "#e8c27a"];
const tip = { contentStyle: { borderRadius: 6, border: "1px solid #e3e4df", fontSize: 12, boxShadow: "0 8px 24px -8px rgba(17,24,39,.15)" } };

export function TrendChart({ points }: { points: Array<{ period: string; quoted: number; won: number; lost: number }> }) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={points} margin={{ left: -20, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="period" tickFormatter={monthLabel} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip {...tip} labelFormatter={(l) => monthLabel(String(l))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="quoted" name="Quoted" fill="#d3d5ce" radius={[4, 4, 0, 0]} />
          <Bar dataKey="won" name="Won" fill="#0e8f79" radius={[4, 4, 0, 0]} />
          <Bar dataKey="lost" name="Lost" fill="#e8b1aa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CapacityChart({ rows }: { rows: Array<{ week_start: string; booked: number | null; unfilled: number; cancellations: number }> }) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={rows.map((r) => ({ ...r, week: r.week_start.slice(5) }))} margin={{ left: -20, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="week" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} />
          <Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="booked" name="Booked" fill="#315cf5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="cancellations" name="Cancelled" stackId="b" fill="#d69a38" />
          <Bar dataKey="unfilled" name="Left empty" stackId="b" fill="#efd6a4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgingChart({ buckets }: { buckets: Record<string, { count: number; total: number }> }) {
  const data = Object.entries(buckets).map(([k, v]) => ({ bucket: `${k} days`, total: v.total, count: v.count }));
  return (
    <div className="h-48">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -10, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="bucket" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={money} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip {...tip} formatter={(v) => `$${Number(v).toLocaleString()}`} />
          <Bar dataKey="total" name="Overdue balance" fill="#c4453a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseChart({ monthly }: { monthly: Array<{ month: string; byCategory: Record<string, number> }> }) {
  const cats = [...new Set(monthly.flatMap((m) => Object.keys(m.byCategory)))];
  const data = monthly.map((m) => ({ month: m.month, ...m.byCategory }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -5, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={money} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip {...tip} labelFormatter={(l) => monthLabel(String(l))} formatter={(v) => `$${Number(v).toLocaleString()}`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {cats.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={PALETTE[i % PALETTE.length]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SponsorWeeklyChart({ data }: { data: Array<{ week: string; enrolledToDate: number; improvements: number; activations: number }> }) {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -15, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="week" tickFormatter={(w) => String(w).slice(5)} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area isAnimationActive={false} type="monotone" dataKey="enrolledToDate" name="Businesses enrolled" stroke="#315cf5" fill="#eef2fe" />
          <Area isAnimationActive={false} type="monotone" dataKey="improvements" name="Readiness improvements" stroke="#0e8f79" fill="#e6f3f0" />
          <Area isAnimationActive={false} type="monotone" dataKey="activations" name="Capabilities activated" stroke="#d69a38" fill="#fbf3e3" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReadyBeforeAfter({ before, after }: { before: number; after: number }) {
  return (
    <div className="h-40">
      <ResponsiveContainer>
        <LineChart data={[{ name: "At first check", v: before }, { name: "Today", v: after }]} margin={{ left: -20, right: 20, top: 10 }}>
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} domain={[0, 8]} />
          <Tooltip {...tip} />
          <Line isAnimationActive={false} type="monotone" dataKey="v" name="Avg capabilities ready" stroke="#0e8f79" strokeWidth={2.5} dot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BilledVsExpenses({ months }: { months: Array<{ month: string; billed: number | null; expenses: number | null }> }) {
  return (
    <div className="h-52">
      <ResponsiveContainer>
        <BarChart data={months} margin={{ left: -5, right: 4 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={money} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip {...tip} labelFormatter={(l) => monthLabel(String(l))} formatter={(v) => `$${Number(v).toLocaleString()}`} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={8} />
          <Bar dataKey="billed" name="Billed" fill="#315cf5" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expenses" name="Expenses" fill="#c9ccc4" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
