import { Fragment, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api } from "../api";
import { BandBadge, StatusBadge } from "../components/Badges";
import type { Alert, Incident } from "../types";
import { useAlertStream } from "../ws";
import { bandFor, timeAgo } from "@/lib/sev";
import { cn } from "@/lib/utils";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<Alert[]>([]);

  const load = () => api<Incident[]>("/api/incidents").then(setIncidents).catch(console.error);
  useEffect(() => {
    load();
  }, []);
  useAlertStream(load);

  async function toggle(id: number) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    const data = await api<{ incident: Incident; alerts: Alert[] }>(`/api/incidents/${id}`);
    setDetail(data.alerts);
    setExpanded(id);
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm">Incidents</CardTitle>
        <CardDescription className="text-xs">
          Correlated alert groups — same actor and rule family within a 30-minute window
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 pl-4" />
            <TableHead className="w-24">Severity</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-20 text-center">Alerts</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-28 pr-4 text-right">Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((inc) => (
            <Fragment key={inc.id}>
              <TableRow onClick={() => toggle(inc.id)} className="cursor-pointer">
                <TableCell className="pl-4">
                  <ChevronRight
                    className={cn("size-4 text-muted-foreground transition-transform", expanded === inc.id && "rotate-90")}
                  />
                </TableCell>
                <TableCell>
                  <BandBadge band={bandFor(inc.max_severity)} score={inc.max_severity} />
                </TableCell>
                <TableCell className="max-w-md truncate text-sm">{inc.title}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="font-mono text-[11px] tabular-nums">{inc.alert_count}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px]",
                      inc.status === "open" ? "border-p2/25 bg-p2/12 text-p2" : "text-muted-foreground"
                    )}
                  >
                    {inc.status}
                  </Badge>
                </TableCell>
                <TableCell className="pr-4 text-right text-xs text-muted-foreground">{timeAgo(inc.last_seen)}</TableCell>
              </TableRow>
              {expanded === inc.id &&
                detail.map((a) => (
                  <TableRow key={`a-${a.id}`} className="bg-background/60 text-xs hover:bg-background/60">
                    <TableCell />
                    <TableCell className="pl-6">
                      <BandBadge band={a.severity_band} score={a.severity_score} />
                    </TableCell>
                    <TableCell colSpan={2} className="text-xs">
                      <span className="font-mono text-muted-foreground">#{a.id}</span> — {a.rule_description}
                    </TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="pr-4 text-right text-muted-foreground">{timeAgo(a.received_at)}</TableCell>
                  </TableRow>
                ))}
            </Fragment>
          ))}
          {incidents.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                No incidents yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
