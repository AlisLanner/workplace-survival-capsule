import type { AgentName } from "../types/agent";

export type DimensionId = `GE0${1|2|3|4|5|6|7|8}`;
export type Sufficiency = "none" | "partial" | "sufficient";
export type Valence = "support" | "counter" | "mixed";
export interface Slot {
  slot_id: string; display_code: string; dimension_id: DimensionId;
  observation: string; target_agent: AgentName; probe_intent: string;
  required_fact_ids: string[]; trigger_event_ids: string[]; priority: number;
}
export interface Fact { id: string; text: string }
export interface Definition {
  assessment_version: string; schema_version: string; scenario_id: string; scenario_code: string;
  title: string; user_role: string;
  dimensions: Array<{ id: DimensionId; name: string; meaning: string }>;
  roles: Record<AgentName, { name: string; role: string }>;
  slots: Slot[]; public_facts: Fact[]; role_facts: Record<AgentName, Fact[]>;
  events: Array<{ id: string; round: number; agent: AgentName; facts: Fact[] }>;
  round_policy: { min: number; max: number; max_consecutive_agent_rounds?:number };
  scoring_policy: { samples: number; total_variance_limit: number; dimension_range_limit: number; bands: string[]; boundaries: string[] };
  anchors: Array<{ dimension_id: DimensionId; low: string; middle: string; high: string; missing: string }>;
  prompt_bundle_version: string;
}
export interface Evidence {
  slot_id: string; message_id: string; quote: string; sufficiency: Sufficiency; valence: Valence; reason: string;
  start?: number; end?: number;
}
export interface Opportunity {
  question_message_id: string; fact_ids: string[]; event_id?: string; round: number;
}
export interface SlotState { opportunities: Opportunity[]; evidence: Evidence[] }
export interface Ge8State {
  schema_version: string; assessment_version: string; scenario_id: string;
  round: number; min_round: number; max_round: number; phase: string;
  released_facts: Record<string, string>; released_events: Record<string, string>;
  slots: Record<string, SlotState>; last_agent?: AgentName; consecutive_agent: number;
  pending_probe?: Probe;
}
export interface Probe { agent: AgentName; slot_ids: string[]; questions: string[]; facts: Fact[]; event_ids: string[] }
export interface ModelConfig {
  mock: boolean; base_url: string; fast_model: string; judge_model: string;
  director: { temperature: number; max_tokens: number; timeout_ms: number; thinking: boolean; evidence_scope?: "latest_candidate" };
  npc: { temperature: number; max_tokens: number; timeout_ms: number; thinking: boolean };
  guard: { temperature: number; max_tokens: number; timeout_ms: number; thinking: boolean };
  judge: { temperature: number; max_tokens: number; timeout_ms: number; thinking: boolean };
  max_attempts: number;
}
export interface Snapshot {
  snapshot_format?:"ge8-snapshot/2";
  snapshot_hash?:string;
  schema_version: string; definition: Definition; definition_hash: string; code_sha: string;
  code_dirty?:boolean;
  prompts: Record<string, { key: string; content: string; hash: string }>;
  prompt_bundle_hash: string; model: ModelConfig;
  runtime?:{group_chat_enabled:boolean;group_chat_rounds:number[]};
}
export type DimensionStatus = "rated" | "not_observed" | "insufficient" | "scoring_failed";
export interface SlotResult {
  slot_id: string; opportunity: Opportunity[]; sufficiency: Sufficiency;
  valence: Valence | null; evidence: Evidence[];
}
export interface DimensionResult {
  id: DimensionId; name: string; score: number|null; status: DimensionStatus;
  analysis: string; slot_results: SlotResult[];
}
export interface Ge8Report {
  assessment_version: string; schema_version: string; scenario_id: string;
  dimension_results: DimensionResult[]; dimension_scores: Record<string, number>;
  dimension_analysis: Record<string, string>; total_score: number|null;
  radar_chart_data: Array<{name: string;score: number;max: number}>;
  report_status: "confident"|"provisional"|"unratable"|"debug"|"scoring_failed";
  level: string; summary: string; conflict_style: string;
  strengths: string[]; risks: string[]; suggestions: string[]; final_recommendation: string;
  evidence: Array<{dimension: string;message_id: string;quote: string;analysis: string}>;
  mock_generated: boolean; human_review_required: boolean; human_review_reason: string;
  review_reasons: string[]; sampling_stats: Record<string, unknown>; assessment_meta: Record<string, unknown>;
  coverage_status: {covered_dimensions: string[];insufficient_dimensions: string[];complete: boolean};
}
export interface TranscriptMessage { id: string; senderType: string; senderName: string; content: string; roundIndex: number }
