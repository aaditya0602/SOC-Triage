import { useState } from "react";
import {
  ArrowUpRight, Database, FileText, Fingerprint, Flame, RotateCcw, Search, ShieldX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/api";
import type { Alert } from "@/types";
import { parseUTC } from "@/lib/sev";
import { BandBadge, StatusBadge, VerdictDot } from "./Badges";
import AiPanel from "./AiPanel";
import ScoreGauge from "./ScoreGauge";

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="size-3.5" /> {children}
    </h3>
  );
}

export default function AlertSheet({
  alert,
  onClose,
  onChanged,
}: {
  alert: Alert | null;
  onClose: () => void;
  onChanged: (a: Alert) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  if (!alert) return null;
  const isResolved = alert.status === "escalated" || alert.status === "dismissed";

  async function triage(action: string) {
    if (!alert) return;
    setBusy(action);
    try {
      const updated = await api<Alert>(`/api/alerts/${alert.id}/triage`, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      });
      setNote("");
      onChanged(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy("");
    }
  }

  const b = alert.score_breakdown;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="sticky top-0 z-10 border-b bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <BandBadge band={alert.severity_band} score={alert.severity_score} />
            <StatusBadge status={alert.status} />
            <span className="font-mono text-xs text-muted-foreground">
              #{alert.id} · {alert.source} · rule {alert.rule_id}
            </span>
          </div>
          <SheetTitle className="text-left text-base leading-snug">{alert.rule_description}</SheetTitle>
          <SheetDescription className="sr-only">Alert detail and triage</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <AiPanel alert={alert} onChanged={onChanged} />

          {/* Triage */}
          <div>
            <SectionTitle icon={Fingerprint}>Triage</SectionTitle>
            <Textarea
              placeholder="Analyst note — stored in the audit log and fed to future AI analyses of this rule…"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mb-2.5 resize-none text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {isResolved ? (
                <Button variant="outline" size="sm" disabled={!!busy} onClick={() => triage("reopen")}>
                  <RotateCcw className="size-3.5" /> Reopen
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() => triage("escalate")}
                    className="bg-p1 text-white hover:bg-p1/85"
                  >
                    <Flame className="size-3.5" /> {busy === "escalate" ? "Escalating…" : "Escalate"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() => triage("investigate")}
                    className="bg-ai text-white hover:bg-ai/85"
                  >
                    <Search className="size-3.5" /> {busy === "investigate" ? "…" : "Investigate"}
                  </Button>
                  <Button variant="outline" size="sm" disabled={!!busy} onClick={() => triage("dismiss")}>
                    <ShieldX className="size-3.5" /> {busy === "dismiss" ? "…" : "Dismiss"}
                  </Button>
                </>
              )}
            </div>
            {alert.triaged_by && (
              <p className="mt-2 text-xs text-muted-foreground">
                Last triaged by <span className="text-foreground">{alert.triaged_by}</span>
                {alert.triage_note ? <> — “{alert.triage_note}”</> : null}
              </p>
            )}
          </div>

          <Separator />

          {/* Threat intel */}
          <div>
            <SectionTitle icon={Database}>Threat intelligence</SectionTitle>
            {Object.keys(alert.enrichment).length === 0 ? (
              <p className="text-sm text-muted-foreground">No external IOCs extracted from this alert</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(alert.enrichment).map(([ioc, entry]) => (
                  <div key={ioc} className="rounded-lg border bg-muted/40 p-3">
                    <p className="mb-2 flex items-center gap-2 font-mono text-xs">
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase">{entry.type}</Badge>
                      <span className="truncate">{ioc}</span>
                    </p>
                    <div className="space-y-1.5">
                      {Object.values(entry.results).map((r) => (
                        <div key={r.provider} className="flex items-center gap-2 text-xs">
                          <span className="w-20 shrink-0 text-muted-foreground">{r.provider}</span>
                          <VerdictDot verdict={r.verdict} />
                          <span className="truncate text-muted-foreground">{r.summary}</span>
                          {r.cached && <Badge variant="outline" className="text-[9px] text-muted-foreground">cached</Badge>}
                          {r.link && (
                            <a
                              href={r.link}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline"
                            >
                              pivot <ArrowUpRight className="size-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Score breakdown */}
          <div>
            <SectionTitle icon={Flame}>Severity score</SectionTitle>
            <div className="flex items-center gap-5 rounded-lg border bg-muted/40 p-4">
              <ScoreGauge score={alert.severity_score} />
              <div className="grid flex-1 grid-cols-3 gap-3 text-center">
                {[
                  { label: `rule level ${alert.rule_level}/15`, value: b.rule_component ?? 0, max: 55 },
                  { label: "threat intel", value: b.intel_component ?? 0, max: 35 },
                  { label: "context bonus", value: b.context_bonus ?? 0, max: 10 },
                ].map((part) => (
                  <div key={part.label}>
                    <p className="font-mono text-lg font-semibold tabular-nums">{part.value}</p>
                    <div className="mx-auto my-1 h-1 w-full max-w-16 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${(part.value / part.max) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{part.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Context */}
          <div>
            <SectionTitle icon={FileText}>Alert context</SectionTitle>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Agent</dt>
              <dd>{alert.agent_name} <span className="font-mono text-xs text-muted-foreground">({alert.agent_ip})</span></dd>
              <dt className="text-muted-foreground">Source IP</dt>
              <dd className="font-mono text-xs">{alert.src_ip ?? "—"}</dd>
              <dt className="text-muted-foreground">Dest IP</dt>
              <dd className="font-mono text-xs">{alert.dst_ip ?? "—"}</dd>
              <dt className="text-muted-foreground">User</dt>
              <dd>{alert.src_user ?? "—"}</dd>
              <dt className="text-muted-foreground">Groups</dt>
              <dd className="flex flex-wrap gap-1">
                {alert.rule_groups.map((g) => (
                  <Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>
                ))}
              </dd>
              <dt className="text-muted-foreground">Incident</dt>
              <dd>{alert.incident_id ? <span className="font-mono text-xs">#{alert.incident_id}</span> : "—"}</dd>
              <dt className="text-muted-foreground">Event time</dt>
              <dd className="text-xs">{parseUTC(alert.event_time).toLocaleString()}</dd>
            </dl>
            <pre className="mt-3 overflow-x-auto rounded-lg border bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {alert.full_log || "(no log line)"}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
