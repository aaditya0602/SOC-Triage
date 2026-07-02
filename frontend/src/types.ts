export interface IntelResult {
  provider: string;
  verdict: "malicious" | "suspicious" | "clean" | "unknown";
  score: number;
  summary: string;
  details: Record<string, unknown>;
  link: string;
  cached?: boolean;
  error?: boolean;
}

export interface IocEnrichment {
  type: string;
  results: Record<string, IntelResult>;
}

export interface LLMAnalysis {
  summary?: string;
  attack_stage?: string;
  mitre_techniques?: string[];
  false_positive_likelihood?: string;
  recommended_actions?: string[];
  confidence?: string;
  provider?: string;
  past_verdicts_considered?: number;
}

export interface Alert {
  id: number;
  external_id: string | null;
  source: string;
  rule_id: string | null;
  rule_level: number;
  rule_description: string;
  rule_groups: string[];
  mitre: { ids?: string[]; tactics?: string[]; techniques?: string[] };
  agent_name: string | null;
  agent_ip: string | null;
  src_ip: string | null;
  dst_ip: string | null;
  src_user: string | null;
  full_log: string;
  event_time: string;
  received_at: string;
  iocs: { type: string; value: string }[];
  enrichment: Record<string, IocEnrichment>;
  severity_score: number;
  severity_band: "P1" | "P2" | "P3" | "P4";
  score_breakdown: Record<string, number>;
  llm_analysis: LLMAnalysis;
  pipeline_status: string;
  status: "new" | "investigating" | "escalated" | "dismissed";
  triage_note: string | null;
  triaged_by: string | null;
  triaged_at: string | null;
  incident_id: number | null;
}

export interface Incident {
  id: number;
  correlation_key: string;
  title: string;
  status: string;
  first_seen: string;
  last_seen: string;
  alert_count: number;
  max_severity: number;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
}

export interface Stats {
  total_alerts: number;
  open_alerts: number;
  escalated: number;
  dismissed: number;
  open_incidents: number;
  avg_severity: number;
  by_band: Record<string, number>;
  by_status: Record<string, number>;
  top_rules: { rule: string; count: number }[];
  timeline: { hour: string; count: number }[];
}
