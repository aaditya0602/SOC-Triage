import { useEffect, useState } from "react";
import { api } from "../api";
import { BandBadge, StatusBadge } from "../components/Badges";
import type { Alert, Incident } from "../types";
import { useAlertStream } from "../ws";

function bandFor(score: number): string {
  return score >= 80 ? "P1" : score >= 60 ? "P2" : score >= 35 ? "P3" : "P4";
}

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
    <div className="rounded-lg border border-edge bg-panel">
      <div className="border-b border-edge px-4 py-3">
        <h1 className="font-semibold">Incidents</h1>
        <p className="text-xs text-ink-dim">Correlated alert groups (same actor + rule family within window)</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-dim">
            <th className="px-4 py-2">Severity</th>
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Alerts</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) => (
            <>
              <tr
                key={inc.id}
                onClick={() => toggle(inc.id)}
                className="cursor-pointer border-t border-edge/50 hover:bg-panel-2"
              >
                <td className="px-4 py-2.5">
                  <BandBadge band={bandFor(inc.max_severity)} score={inc.max_severity} />
                </td>
                <td className="px-4 py-2.5">{inc.title}</td>
                <td className="px-4 py-2.5 font-mono">{inc.alert_count}</td>
                <td className="px-4 py-2.5">
                  <span className={inc.status === "open" ? "text-p2" : "text-ink-dim"}>{inc.status}</span>
                </td>
                <td className="px-4 py-2.5 text-ink-dim">{new Date(inc.last_seen).toLocaleString()}</td>
              </tr>
              {expanded === inc.id &&
                detail.map((a) => (
                  <tr key={`a-${a.id}`} className="border-t border-edge/30 bg-surface/50 text-xs">
                    <td className="px-4 py-2 pl-8">
                      <BandBadge band={a.severity_band} score={a.severity_score} />
                    </td>
                    <td className="px-4 py-2" colSpan={2}>
                      #{a.id} — {a.rule_description}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-2 text-ink-dim">{new Date(a.received_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
            </>
          ))}
          {incidents.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink-dim">
                No incidents yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
