import type { Alert } from "@/types";

export const BAND_LABEL: Record<string, string> = {
  P1: "Critical",
  P2: "High",
  P3: "Medium",
  P4: "Low",
};

/** Tailwind classes keyed to the severity tokens in index.css */
export const BAND_CLASSES: Record<string, string> = {
  P1: "bg-p1/15 text-p1 border-p1/30",
  P2: "bg-p2/15 text-p2 border-p2/30",
  P3: "bg-p3/15 text-p3 border-p3/30",
  P4: "bg-p4/15 text-p4 border-p4/30",
};

export const BAND_VAR: Record<string, string> = {
  P1: "var(--sev-p1)",
  P2: "var(--sev-p2)",
  P3: "var(--sev-p3)",
  P4: "var(--sev-p4)",
};

export const STATUS_CLASSES: Record<string, string> = {
  new: "bg-primary/12 text-primary border-primary/25",
  investigating: "bg-ai/12 text-ai border-ai/25",
  escalated: "bg-p1/12 text-p1 border-p1/25",
  dismissed: "bg-muted text-muted-foreground border-transparent",
};

export const VERDICT_CLASSES: Record<string, string> = {
  malicious: "bg-p1",
  suspicious: "bg-p3",
  clean: "bg-emerald-400",
  unknown: "bg-p4",
};

export function bandFor(score: number): "P1" | "P2" | "P3" | "P4" {
  return score >= 80 ? "P1" : score >= 60 ? "P2" : score >= 35 ? "P3" : "P4";
}

export function iocVerdictCounts(alert: Alert) {
  let malicious = 0;
  let suspicious = 0;
  for (const entry of Object.values(alert.enrichment)) {
    for (const r of Object.values(entry.results)) {
      if (r.verdict === "malicious") malicious += 1;
      else if (r.verdict === "suspicious") suspicious += 1;
    }
  }
  return { malicious, suspicious };
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
