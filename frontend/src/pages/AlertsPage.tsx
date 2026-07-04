import { useCallback, useEffect, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api } from "../api";
import { BandBadge, PipelineBadge, StatusBadge } from "../components/Badges";
import AlertSheet from "../components/AlertSheet";
import type { Alert } from "../types";
import { useAlertStream } from "../ws";
import { timeAgo } from "@/lib/sev";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(ALL);
  const [band, setBand] = useState(ALL);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Alert | null>(null);
  const flashIds = useRef(new Set<number>());

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status !== ALL) params.set("status", status);
    if (band !== ALL) params.set("band", band);
    if (search) params.set("search", search);
    api<{ total: number; items: Alert[] }>(`/api/alerts?${params}`)
      .then((r) => {
        setAlerts(r.items);
        setTotal(r.total);
      })
      .catch(console.error);
  }, [status, band, search]);

  useEffect(load, [load]);

  useAlertStream((event) => {
    flashIds.current.add(event.data.id);
    setTimeout(() => flashIds.current.delete(event.data.id), 1700);
    load();
    // Keep the open sheet in sync as the pipeline progresses
    setSelected((cur) => (cur && event.data.id === cur.id ? event.data : cur));
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <p className="mr-auto text-sm text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">{total}</span> alerts
        </p>
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search rule, IP, agent…"
            className="h-8 w-60 pl-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={band} onValueChange={setBand}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All severities</SelectItem>
            <SelectItem value="P1">P1 — Critical</SelectItem>
            <SelectItem value="P2">P2 — High</SelectItem>
            <SelectItem value="P3">P3 — Medium</SelectItem>
            <SelectItem value="P4">P4 — Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24 pl-4">Severity</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead className="w-36">Source</TableHead>
              <TableHead className="w-36">Agent</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24 pr-4 text-right">Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((a) => (
              <TableRow
                key={a.id}
                onClick={() => setSelected(a)}
                className={cn(
                  "cursor-pointer",
                  selected?.id === a.id && "bg-accent",
                  flashIds.current.has(a.id) && "row-flash"
                )}
              >
                <TableCell className="pl-4">
                  <BandBadge band={a.severity_band} score={a.severity_score} />
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="truncate text-sm">{a.rule_description}</p>
                  <p className="text-xs text-muted-foreground">
                    rule {a.rule_id} · level {a.rule_level} <PipelineBadge status={a.pipeline_status} />
                  </p>
                </TableCell>
                <TableCell className="font-mono text-xs">{a.src_ip ?? "—"}</TableCell>
                <TableCell className="text-xs">{a.agent_name ?? "—"}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="whitespace-nowrap pr-4 text-right text-xs text-muted-foreground">
                  {timeAgo(a.received_at)}
                </TableCell>
              </TableRow>
            ))}
            {alerts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No alerts match — run <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">python scripts/simulator.py --all</code>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertSheet
        alert={selected}
        onClose={() => setSelected(null)}
        onChanged={(updated) => {
          setSelected(updated);
          load();
        }}
      />
    </div>
  );
}
