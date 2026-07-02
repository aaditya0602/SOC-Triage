import { useState } from "react";
import { api } from "../api";
import type { Alert } from "../types";
import { BandBadge, StatusBadge, VerdictDot } from "./Badges";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-edge px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-dim">{title}</h3>
      {children}
    </section>
  );
}

export default function AlertDrawer({
  alert,
  onClose,
  onChanged,
}: {
  alert: Alert;
  onClose: () => void;
  onChanged: (a: Alert) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const llm = alert.llm_analysis;

  async function triage(action: string) {
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

  const isResolved = alert.status === "escalated" || alert.status === "dismissed";

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l border-edge bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start gap-3 border-b border-edge bg-panel px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <BandBadge band={alert.severity_band} score={alert.severity_score} />
              <StatusBadge status={alert.status} />
              <span className="text-xs text-ink-dim">#{alert.id} · {alert.source}</span>
            </div>
            <h2 className="truncate font-semibold">{alert.rule_description}</h2>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-ink-dim hover:bg-panel-2">✕</button>
        </div>

        {/* AI analysis */}
        <Section title={`AI analysis ${llm.provider ? `(${llm.provider})` : ""}`}>
          {alert.pipeline_status !== "complete" && alert.pipeline_status !== "failed" ? (
            <p className="animate-pulse text-sm text-accent">Pipeline running: {alert.pipeline_status}…</p>
          ) : llm.summary ? (
            <div className="space-y-3 text-sm">
              <p className="rounded border border-accent/20 bg-accent/5 p-3 leading-relaxed">{llm.summary}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {llm.attack_stage && (
                  <span className="rounded bg-panel-2 px-2 py-1">stage: <b>{llm.attack_stage}</b></span>
                )}
                {llm.false_positive_likelihood && (
                  <span className="rounded bg-panel-2 px-2 py-1">FP likelihood: <b>{llm.false_positive_likelihood}</b></span>
                )}
                {llm.confidence && (
                  <span className="rounded bg-panel-2 px-2 py-1">confidence: <b>{llm.confidence}</b></span>
                )}
                {(llm.past_verdicts_considered ?? 0) > 0 && (
                  <span className="rounded bg-panel-2 px-2 py-1">{llm.past_verdicts_considered} past verdicts weighed</span>
                )}
              </div>
              {(llm.mitre_techniques?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {llm.mitre_techniques!.map((t) => (
                    <span key={t} className="rounded border border-p2/40 bg-p2/10 px-2 py-0.5 text-xs text-p2">{t}</span>
                  ))}
                </div>
              )}
              {(llm.recommended_actions?.length ?? 0) > 0 && (
                <ol className="list-decimal space-y-1 pl-5">
                  {llm.recommended_actions!.map((a, i) => <li key={i}>{a}</li>)}
                </ol>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-dim">No analysis available (pipeline {alert.pipeline_status})</p>
          )}
        </Section>

        {/* Triage */}
        <Section title="Triage">
          <textarea
            placeholder="Analyst note (stored in audit log, feeds future AI analysis)…"
            className="mb-3 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            {isResolved ? (
              <button
                onClick={() => triage("reopen")}
                disabled={!!busy}
                className="rounded border border-edge px-3 py-1.5 text-sm hover:bg-panel-2 disabled:opacity-50"
              >
                Reopen
              </button>
            ) : (
              <>
                <button
                  onClick={() => triage("escalate")}
                  disabled={!!busy}
                  className="rounded bg-p1 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "escalate" ? "…" : "Escalate"}
                </button>
                <button
                  onClick={() => triage("investigate")}
                  disabled={!!busy}
                  className="rounded bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "investigate" ? "…" : "Investigate"}
                </button>
                <button
                  onClick={() => triage("dismiss")}
                  disabled={!!busy}
                  className="rounded border border-edge px-3 py-1.5 text-sm hover:bg-panel-2 disabled:opacity-50"
                >
                  {busy === "dismiss" ? "…" : "Dismiss"}
                </button>
              </>
            )}
          </div>
          {alert.triaged_by && (
            <p className="mt-2 text-xs text-ink-dim">
              Last triaged by {alert.triaged_by}
              {alert.triage_note ? ` — "${alert.triage_note}"` : ""}
            </p>
          )}
        </Section>

        {/* Threat intel */}
        <Section title="Threat intelligence">
          {Object.keys(alert.enrichment).length === 0 ? (
            <p className="text-sm text-ink-dim">No external IOCs extracted</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(alert.enrichment).map(([ioc, entry]) => (
                <div key={ioc} className="rounded border border-edge bg-panel-2 p-3">
                  <p className="mb-2 font-mono text-xs">
                    <span className="mr-2 rounded bg-surface px-1.5 py-0.5 uppercase text-ink-dim">{entry.type}</span>
                    {ioc}
                  </p>
                  <div className="space-y-1 text-xs">
                    {Object.values(entry.results).map((r) => (
                      <div key={r.provider} className="flex items-center gap-2">
                        <span className="w-20 text-ink-dim">{r.provider}</span>
                        <VerdictDot verdict={r.verdict} />
                        <span className="text-ink-dim">{r.summary}</span>
                        {r.link && (
                          <a href={r.link} target="_blank" rel="noreferrer" className="ml-auto text-accent hover:underline">
                            pivot ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Score breakdown */}
        <Section title="Severity score breakdown">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded bg-panel-2 p-2">
              <p className="text-lg font-bold">{alert.score_breakdown.rule_component ?? 0}</p>
              <p className="text-xs text-ink-dim">rule level ({alert.rule_level}/15)</p>
            </div>
            <div className="rounded bg-panel-2 p-2">
              <p className="text-lg font-bold">{alert.score_breakdown.intel_component ?? 0}</p>
              <p className="text-xs text-ink-dim">threat intel</p>
            </div>
            <div className="rounded bg-panel-2 p-2">
              <p className="text-lg font-bold">{alert.score_breakdown.context_bonus ?? 0}</p>
              <p className="text-xs text-ink-dim">context bonus</p>
            </div>
          </div>
        </Section>

        {/* Context */}
        <Section title="Alert context">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-dim">Agent</dt><dd>{alert.agent_name} ({alert.agent_ip})</dd>
            <dt className="text-ink-dim">Source IP</dt><dd className="font-mono">{alert.src_ip ?? "—"}</dd>
            <dt className="text-ink-dim">Dest IP</dt><dd className="font-mono">{alert.dst_ip ?? "—"}</dd>
            <dt className="text-ink-dim">User</dt><dd>{alert.src_user ?? "—"}</dd>
            <dt className="text-ink-dim">Groups</dt><dd>{alert.rule_groups.join(", ")}</dd>
            <dt className="text-ink-dim">Incident</dt>
            <dd>{alert.incident_id ? `#${alert.incident_id}` : "—"}</dd>
            <dt className="text-ink-dim">Event time</dt><dd>{new Date(alert.event_time).toLocaleString()}</dd>
          </dl>
          <pre className="mt-3 overflow-x-auto rounded bg-surface p-3 text-xs leading-relaxed text-ink-dim">
            {alert.full_log || "(no log line)"}
          </pre>
        </Section>
      </div>
    </div>
  );
}
