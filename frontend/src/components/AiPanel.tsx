import { useState } from "react";
import { AlertTriangle, Check, ListChecks, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/api";
import type { Alert } from "@/types";
import { cn } from "@/lib/utils";

const FP_TONE: Record<string, string> = {
  low: "bg-p1/12 text-p1 border-p1/25",       // low FP likelihood = real threat
  medium: "bg-p3/12 text-p3 border-p3/25",
  high: "bg-emerald-400/12 text-emerald-400 border-emerald-400/25",
};

function Chip({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 text-[11px]", className)}>
      <span className="font-normal opacity-60">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </Badge>
  );
}

export default function AiPanel({ alert, onChanged }: { alert: Alert; onChanged: (a: Alert) => void }) {
  const [regenerating, setRegenerating] = useState(false);
  const llm = alert.llm_analysis;
  const running = alert.pipeline_status !== "complete" && alert.pipeline_status !== "failed";
  const isMock = (llm.provider ?? "").includes("mock");

  async function regenerate() {
    setRegenerating(true);
    try {
      onChanged(await api<Alert>(`/api/alerts/${alert.id}/reanalyze`, { method: "POST" }));
    } catch (err) {
      console.error(err);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="rise-in relative overflow-hidden rounded-xl border border-ai/25 bg-gradient-to-b from-ai/[0.07] to-transparent">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-ai/15 px-4 py-2.5">
        <Sparkles className="size-4 text-ai" />
        <span className="text-sm font-semibold">AI Analysis</span>
        {llm.provider && (
          <Badge variant="outline" className="border-ai/25 bg-ai/10 font-mono text-[10px] text-ai">
            {llm.provider}
          </Badge>
        )}
        {(llm.past_verdicts_considered ?? 0) > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {llm.past_verdicts_considered} past verdicts weighed
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Prior analyst decisions on this rule fed into this analysis</TooltipContent>
          </Tooltip>
        )}
        <div className="ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-ai"
                onClick={regenerate}
                disabled={regenerating || running}
              >
                {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Regenerate
              </Button>
            </TooltipTrigger>
            <TooltipContent>Re-run the LLM with current triage context</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {running || regenerating ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-ai">
              <Loader2 className="size-3.5 animate-spin" />
              {regenerating ? "Re-analyzing with the model…" : `Pipeline ${alert.pipeline_status}…`}
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : llm.summary ? (
          <>
            {isMock && (
              <div className="flex items-center gap-2 rounded-md border border-p3/25 bg-p3/8 px-3 py-2 text-xs text-p3">
                <AlertTriangle className="size-3.5 shrink-0" />
                Fallback analysis — the LLM was unreachable. Hit Regenerate for a real one.
              </div>
            )}
            <p className="text-sm leading-relaxed">{llm.summary}</p>

            <div className="flex flex-wrap gap-1.5">
              {llm.attack_stage && <Chip label="stage" value={llm.attack_stage} className="border-ai/25 bg-ai/10 text-ai" />}
              {llm.false_positive_likelihood && (
                <Chip label="FP likelihood" value={llm.false_positive_likelihood} className={FP_TONE[llm.false_positive_likelihood]} />
              )}
              {llm.confidence && <Chip label="confidence" value={llm.confidence} />}
            </div>

            {(llm.mitre_techniques?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {llm.mitre_techniques!.map((t) => (
                  <a
                    key={t}
                    href={`https://attack.mitre.org/techniques/${t.split(" ")[0].replace(".", "/")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-p2/30 bg-p2/10 px-2 py-0.5 font-mono text-[11px] text-p2 transition-colors hover:bg-p2/20"
                  >
                    {t}
                  </a>
                ))}
              </div>
            )}

            {(llm.recommended_actions?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ListChecks className="size-3.5" /> Recommended actions
                </p>
                <ol className="space-y-1.5">
                  {llm.recommended_actions!.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-snug">
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-ai/15 font-mono text-[10px] font-semibold text-ai">
                        {i + 1}
                      </span>
                      {a}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4" /> No analysis available (pipeline {alert.pipeline_status})
          </p>
        )}
      </div>
    </div>
  );
}
