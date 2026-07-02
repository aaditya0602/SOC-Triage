const BAND_STYLES: Record<string, string> = {
  P1: "bg-p1/15 text-p1 border-p1/40",
  P2: "bg-p2/15 text-p2 border-p2/40",
  P3: "bg-p3/15 text-p3 border-p3/40",
  P4: "bg-p4/15 text-p4 border-p4/40",
};

export function BandBadge({ band, score }: { band: string; score?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-bold ${BAND_STYLES[band] ?? BAND_STYLES.P4}`}>
      {band}
      {score !== undefined && <span className="font-normal opacity-80">{score}</span>}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  investigating: "bg-violet-500/15 text-violet-400 border-violet-500/40",
  escalated: "bg-rose-500/15 text-rose-400 border-rose-500/40",
  dismissed: "bg-slate-500/15 text-slate-400 border-slate-500/40",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.dismissed}`}>
      {status}
    </span>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  malicious: "text-p1",
  suspicious: "text-p2",
  clean: "text-emerald-400",
  unknown: "text-ink-dim",
};

export function VerdictDot({ verdict }: { verdict: string }) {
  return <span className={`font-semibold ${VERDICT_STYLES[verdict] ?? "text-ink-dim"}`}>● {verdict}</span>;
}

export function PipelineBadge({ status }: { status: string }) {
  if (status === "complete") return null;
  const label = status === "failed" ? "pipeline failed" : `${status}…`;
  const cls = status === "failed" ? "text-p1 border-p1/40" : "text-accent border-accent/40 animate-pulse";
  return <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${cls}`}>{label}</span>;
}
