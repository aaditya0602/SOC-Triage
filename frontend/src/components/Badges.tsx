import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { BAND_CLASSES, STATUS_CLASSES, VERDICT_CLASSES } from "@/lib/sev";
import { cn } from "@/lib/utils";

export function BandBadge({ band, score }: { band: string; score?: number }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-mono text-[11px] font-semibold tabular-nums", BAND_CLASSES[band])}>
      {band}
      {score !== undefined && <span className="opacity-70">{Math.round(score)}</span>}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("text-[11px] capitalize", STATUS_CLASSES[status])}>
      {status}
    </Badge>
  );
}

export function PipelineBadge({ status }: { status: string }) {
  if (status === "complete") return null;
  if (status === "failed") {
    return <span className="text-[11px] text-p1">pipeline failed</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-primary">
      <Loader2 className="size-3 animate-spin" />
      {status}…
    </span>
  );
}

export function VerdictDot({ verdict }: { verdict: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize">
      <span className={cn("size-2 rounded-full", VERDICT_CLASSES[verdict] ?? "bg-p4")} />
      <span className={verdict === "malicious" ? "font-medium text-p1" : verdict === "suspicious" ? "text-p3" : "text-muted-foreground"}>
        {verdict}
      </span>
    </span>
  );
}
