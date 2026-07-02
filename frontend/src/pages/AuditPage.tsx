import { useEffect, useState } from "react";
import { api } from "../api";
import type { AuditEntry } from "../types";
import { useAlertStream } from "../ws";

const ACTION_TONE: Record<string, string> = {
  "alert.escalate": "text-p1",
  "alert.dismiss": "text-ink-dim",
  "alert.investigate": "text-violet-400",
  "alert.ingested": "text-accent",
  "auth.login": "text-emerald-400",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const load = () => api<AuditEntry[]>("/api/audit").then(setEntries).catch(console.error);
  useEffect(() => {
    load();
  }, []);
  useAlertStream(load);

  return (
    <div className="rounded-lg border border-edge bg-panel">
      <div className="border-b border-edge px-4 py-3">
        <h1 className="font-semibold">Audit log</h1>
        <p className="text-xs text-ink-dim">Every ingest, login, and triage decision — immutable record</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-dim">
            <th className="px-4 py-2">Time</th>
            <th className="px-4 py-2">Actor</th>
            <th className="px-4 py-2">Action</th>
            <th className="px-4 py-2">Target</th>
            <th className="px-4 py-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-edge/50">
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-ink-dim">
                {new Date(e.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-2">{e.actor}</td>
              <td className={`px-4 py-2 font-mono text-xs ${ACTION_TONE[e.action] ?? ""}`}>{e.action}</td>
              <td className="px-4 py-2 font-mono text-xs">
                {e.target_type} #{e.target_id}
              </td>
              <td className="max-w-md truncate px-4 py-2 text-xs text-ink-dim">
                {JSON.stringify(e.details)}
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink-dim">
                No audit entries yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
