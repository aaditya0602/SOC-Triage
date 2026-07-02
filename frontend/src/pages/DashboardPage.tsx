import { useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../api";
import type { Stats } from "../types";
import { useAlertStream } from "../ws";

const BAND_COLORS: Record<string, string> = {
  P1: "#f43f5e", P2: "#fb923c", P3: "#facc15", P4: "#64748b",
};

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <p className="text-xs uppercase tracking-wider text-ink-dim">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(() => {
    api<Stats>("/api/stats").then(setStats).catch(console.error);
  }, []);

  useEffect(load, [load]);
  useAlertStream(load);

  if (!stats) return <p className="text-ink-dim">Loading…</p>;

  const bandData = ["P1", "P2", "P3", "P4"].map((b) => ({
    name: b,
    value: stats.by_band[b] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Open alerts" value={stats.open_alerts} tone="text-accent" />
        <StatCard label="Critical (P1)" value={stats.by_band.P1 ?? 0} tone="text-p1" />
        <StatCard label="Open incidents" value={stats.open_incidents} tone="text-p2" />
        <StatCard label="Escalated" value={stats.escalated} />
        <StatCard label="Avg severity" value={stats.avg_severity} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-edge bg-panel p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink-dim">Alert volume — last 24h</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.timeline}>
              <CartesianGrid stroke="#232f42" vertical={false} />
              <XAxis dataKey="hour" stroke="#8b98ad" fontSize={11} interval={3} />
              <YAxis stroke="#8b98ad" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#1a2332", border: "1px solid #232f42" }} />
              <Bar dataKey="count" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-edge bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-dim">Severity distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={bandData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}
                   paddingAngle={3} label={({ name, value }) => (value ? `${name}: ${value}` : "")}>
                {bandData.map((entry) => (
                  <Cell key={entry.name} fill={BAND_COLORS[entry.name]} stroke="none" />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a2332", border: "1px solid #232f42" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-edge bg-panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-dim">Top firing rules</h2>
        <table className="w-full text-sm">
          <tbody>
            {stats.top_rules.map((r) => (
              <tr key={r.rule} className="border-t border-edge/50">
                <td className="py-2 pr-4">{r.rule}</td>
                <td className="py-2 text-right font-mono text-ink-dim">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
