import { useEffect, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "../api";
import type { AuditEntry } from "../types";
import { useAlertStream } from "../ws";
import { cn } from "@/lib/utils";

const ACTION_TONE: Record<string, string> = {
  "alert.escalate": "border-p1/25 bg-p1/12 text-p1",
  "alert.dismiss": "text-muted-foreground",
  "alert.investigate": "border-ai/25 bg-ai/12 text-ai",
  "alert.reopen": "border-p3/25 bg-p3/12 text-p3",
  "alert.reanalyze": "border-ai/25 bg-ai/12 text-ai",
  "alert.ingested": "border-primary/25 bg-primary/12 text-primary",
  "auth.login": "border-emerald-400/25 bg-emerald-400/12 text-emerald-400",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const load = () => api<AuditEntry[]>("/api/audit").then(setEntries).catch(console.error);
  useEffect(() => {
    load();
  }, []);
  useAlertStream(load);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm">Audit log</CardTitle>
        <CardDescription className="text-xs">
          Every ingest, login, and triage decision — immutable record
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-44 pl-4">Time</TableHead>
            <TableHead className="w-28">Actor</TableHead>
            <TableHead className="w-40">Action</TableHead>
            <TableHead className="w-28">Target</TableHead>
            <TableHead className="pr-4">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap pl-4 font-mono text-xs text-muted-foreground">
                {new Date(e.timestamp).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm">{e.actor}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("font-mono text-[10px]", ACTION_TONE[e.action])}>
                  {e.action}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {e.target_type} #{e.target_id}
              </TableCell>
              <TableCell className="max-w-md truncate pr-4 font-mono text-[11px] text-muted-foreground">
                {JSON.stringify(e.details)}
              </TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                No audit entries yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
