"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line, AreaChart, Area } from "recharts";

const money = (v: number) => (v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${v}`);
const monthLabel = (m: string) => new Date(`${m}-15`).toLocaleString("en-US", { month: "short" });
const axis = { fontSize: 11, fill: "#64748b" };
const PALETTE = ["#2952e3", "#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#64748b", "#ec4899"];

export function TrendChart({ points }: { points: Array<{ period: string; quoted: number; won: number; lost: number }> }) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={points} margin={{ left: -20, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="period" tickFormatter={monthLabel} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(l) => monthLabel(String(l))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="quoted" name="Quoted" fill="#bfd3fe" radius={[4, 4, 0, 0]} />
          <Bar dataKey="won" name="Won" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="lost" name="Lost" fill="#fda4af" radius={[4, 4, 0, 0]} />
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="week" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="booked" name="Booked" fill="#2952e3" radius={[4, 4, 0, 0]} />
          <Bar dataKey="cancellations" name="Cancelled" stackId="b" fill="#f59e0b" />
          <Bar dataKey="unfilled" name="Left empty" stackId="b" fill="#fcd34d" radius={[4, 4, 0, 0]} />
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="bucket" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={money} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
          <Bar dataKey="total" name="Overdue balance" fill="#ef4444" radius={[4, 4, 0, 0]} />
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={money} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(l) => monthLabel(String(l))} formatter={(v) => `$${Number(v).toLocaleString()}`} />
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="week" tickFormatter={(w) => String(w).slice(5)} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area isAnimationActive={false} type="monotone" dataKey="enrolledToDate" name="Businesses enrolled" stroke="#2952e3" fill="#dbe6fe" />
          <Area isAnimationActive={false} type="monotone" dataKey="improvements" name="Readiness improvements" stroke="#10b981" fill="#d1fae5" />
          <Area isAnimationActive={false} type="monotone" dataKey="activations" name="Capabilities activated" stroke="#f59e0b" fill="#fef3c7" />
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
          <Tooltip />
          <Line isAnimationActive={false} type="monotone" dataKey="v" name="Avg capabilities ready" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
