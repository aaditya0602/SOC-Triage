import { BAND_VAR, bandFor } from "@/lib/sev";

/** Radial severity gauge — the analyst's first read on an alert. */
export default function ScoreGauge({ score, size = 72 }: { score: number; size?: number }) {
  const band = bandFor(score);
  const color = BAND_VAR[band];
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold leading-none tabular-nums" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{band}</span>
      </div>
    </div>
  );
}
