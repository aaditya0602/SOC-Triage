import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { BandBadge, PipelineBadge, StatusBadge } from "../components/Badges";
import AlertDrawer from "../components/AlertDrawer";
import type { Alert } from "../types";
import { useAlertStream } from "../ws";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [band, setBand] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Alert | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (band) params.set("band", band);
    if (search) params.set("search", search);
    api<{ total: number; items: Alert[] }>(`/api/alerts?${params}`)
      .then((r) => {
        setAlerts(r.items);
        setTotal(r.total);
      })
      .catch(console.error);
  }, [status, band, search]);

  useEffect(load, [load]);

  useAlertStream((event) => {
    load();
    // Keep the open drawer in sync as the pipeline progresses
    setSelected((cur) => (cur && event.data.id === cur.id ? event.data : cur));
  });

  const selectCls =
    "rounded border border-edge bg-panel-2 px-2 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-semibold">
          Alert queue <span className="text-sm font-normal text-ink-dim">({total})</span>
        </h1>
        <input
          placeholder="Search rule, IP, agent…"
          className={`${selectCls} w-56`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={selectCls} value={band} onChange={(e) => setBand(e.target.value)}>
          <option value="">All severities</option>
          <option>P1</option><option>P2</option><option>P3</option><option>P4</option>
        </select>
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="new">new</option>
          <option value="investigating">investigating</option>
          <option value="escalated">escalated</option>
          <option value="dismissed">dismissed</option>
        </select>
      </div>

      <div className="rounded-lg border border-edge bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-dim">
              <th className="px-4 py-2">Sev</th>
              <th className="px-4 py-2">Rule</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Agent</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Received</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr
                key={a.id}
                onClick={() => setSelected(a)}
                className={`cursor-pointer border-t border-edge/50 hover:bg-panel-2 ${
                  selected?.id === a.id ? "bg-panel-2" : ""
                }`}
              >
                <td className="px-4 py-2.5">
                  <BandBadge band={a.severity_band} score={a.severity_score} />
                </td>
                <td className="max-w-md px-4 py-2.5">
                  <p className="truncate">{a.rule_description}</p>
                  <p className="text-xs text-ink-dim">
                    rule {a.rule_id} · level {a.rule_level} <PipelineBadge status={a.pipeline_status} />
                  </p>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{a.src_ip ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs">{a.agent_name ?? "—"}</td>
                <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-dim">
                  {new Date(a.received_at).toLocaleTimeString()}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-dim">
                  No alerts match — run the simulator to generate some
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <AlertDrawer
          alert={selected}
          onClose={() => setSelected(null)}
          onChanged={(updated) => {
            setSelected(updated);
            load();
          }}
        />
      )}
    </div>
  );
}
