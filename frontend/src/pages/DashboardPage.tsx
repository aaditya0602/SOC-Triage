import { useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import { Activity, Boxes, Flame, Gauge, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../api";
import type { Stats } from "../types";
import { useAlertStream } from "../ws";
import { BAND_VAR } from "@/lib/sev";
import { cn } from "@/lib/utils";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
};

function StatCard({
  label, value, icon: Icon, tone,
}: { label: string; value: string | number; icon: React.ElementType; tone?: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary", tone)}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="font-mono text-2xl font-bold leading-none tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(() => {
    api<Stats>("/api/stats").then(setStats).catch(console.error);
  }, []);

  useEffect(load, [load]);
  useAlertStream(load);

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const bandData = ["P1", "P2", "P3", "P4"].map((b) => ({ name: b, value: stats.by_band[b] ?? 0 }));
  const maxRule = Math.max(1, ...stats.top_rules.map((r) => r.count));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Open alerts" value={stats.open_alerts} icon={Inbox} tone="bg-primary/12 text-primary" />
        <StatCard label="Critical (P1)" value={stats.by_band.P1 ?? 0} icon={Flame} tone="bg-p1/12 text-p1" />
        <StatCard label="Open incidents" value={stats.open_incidents} icon={Boxes} tone="bg-p2/12 text-p2" />
        <StatCard label="Escalated" value={stats.escalated} icon={Activity} tone="bg-ai/12 text-ai" />
        <StatCard label="Avg severity" value={stats.avg_severity} icon={Gauge} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Alert volume — last 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.timeline}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} interval={3} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "oklch(1 0 0 / 4%)" }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Severity distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={bandData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={3} strokeWidth={0}>
                  {bandData.map((entry) => (
                    <Cell key={entry.name} fill={BAND_VAR[entry.name]} />
                  ))}
                </Pie>
                <ChartTooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex gap-4">
              {bandData.map((b) => (
                <span key={b.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: BAND_VAR[b.name] }} />
                  {b.name} <span className="font-mono tabular-nums">{b.value}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Top firing rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {stats.top_rules.map((r) => (
            <div key={r.rule} className="flex items-center gap-3">
              <p className="w-1/2 truncate text-sm">{r.rule}</p>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${(r.count / maxRule) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-xs tabular-nums text-muted-foreground">{r.count}</span>
            </div>
          ))}
          {stats.top_rules.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No alerts yet — run the simulator</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
