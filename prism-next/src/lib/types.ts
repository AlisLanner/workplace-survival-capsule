/** 正式业务类型：与 workplace-ge8 后端契约一致（项目程序.13 / 视觉版共用）。 */

export type DimensionId = "GE01" | "GE02" | "GE03" | "GE04" | "GE05" | "GE06" | "GE07" | "GE08";

export interface Scenario {
  id: string;
  title: string;
  description: string;
  backgroundForUser: string;
  maxRound: number;
  groupChatEnabled: boolean;
  groupChatRounds: number[];
  status: string;
  assessmentVersion?: string | null;
  origin?: string;
  sessionCount?: number;
  dimensionWeights?: DimensionWeights | null;
  weightsCustomized?: boolean;
}

export interface DimensionWeights {
  mode: "equal" | "importance" | "numeric" | "free_text";
  weights: Record<DimensionId, number>;
  importance?: Record<DimensionId, number>;
  free_text?: Record<DimensionId, string>;
  numeric_input?: Record<DimensionId, number>;
  note?: string;
  updated_at: string;
}

export interface VisibleReply { speaker: string; role: string; content: string }

export interface Message {
  id: string;
  senderType: "user" | "agent" | "system" | string;
  senderName: string;
  senderRole?: string | null;
  content: string;
  roundIndex: number;
  createdAt?: string;
}

export interface AgentTraceEvent {
  id: string;
  nodeId: string;
  agentName: string;
  status: string;
  summary?: string | null;
  sequence: number;
  elapsedMs?: number | null;
}

export interface StartAssessmentResponse {
  session_id: string;
  opening_message: VisibleReply;
  scenario: Scenario;
}

export interface SessionDetail {
  session: { id: string; status: string; round: number; totalScore?: number | null };
  scenario: Scenario;
  messages: Message[];
  report?: Report | null;
}

export interface ReportProgressEvent {
  stage: string;
  message: string;
  percent: number;
  current?: number;
  total?: number;
  elapsedMs?: number;
  delayed?: boolean;
}

export interface SendMessageResponse {
  finished: boolean;
  phase?: string;
  reply: VisibleReply;
  round: number;
  report?: Report;
}

export interface WeightedScores {
  method: string;
  weights: DimensionWeights;
  contributions: Array<{ id: string; name: string; score: number; weight: number; weighted_score: number }>;
  weighted_total: number;
  weighted_percent: number;
  note: string;
}

export interface Report {
  assessment_version?: string;
  scenario_id?: string;
  dimension_results?: Array<{
    id: string;
    name: string;
    score: number | null;
    status: "rated" | "not_observed" | "insufficient" | "scoring_failed";
    analysis: string;
    slot_results: Array<{
      slot_id: string;
      sufficiency: string;
      valence: string | null;
      evidence: Array<{
        message_id: string;
        quote: string;
        reason: string;
        response_context?: { question_message_id: string; answered_opportunities: number };
      }>;
    }>;
  }>;
  review_reasons?: string[];
  total_score: number | null;
  weighted_scores?: WeightedScores | null;
  level: string;
  dimension_scores: Record<string, number>;
  dimension_analysis?: Record<string, string>;
  conflict_style?: string;
  strengths?: string[];
  summary: string;
  risks: string[];
  suggestions: string[];
  evidence: Array<{ dimension: string; quote: string; analysis: string }>;
  radar_chart_data?: Array<{ name: string; score: number; max: number }>;
  final_recommendation: string;
  mock_generated?: boolean;
  report_status?: "confident" | "provisional" | "unratable" | "debug" | "scoring_failed";
  human_review_required?: boolean;
  human_review_reason?: string;
  sampling_stats?: { variance?: number | null; scores?: number[] };
  coverage_status?: { covered_dimensions: string[]; insufficient_dimensions: string[]; complete: boolean };
}

// ── 管理端 ─────────────────────────────────────────────

export interface AdminScenario extends Scenario {}

export interface ScenarioDefinition {
  assessment_version: string;
  scenario_code: string;
  title: string;
  user_role: string;
  dimensions: Array<{ id: string; name: string; meaning: string }>;
  roles: Record<string, { name: string; role: string }>;
  slots: Array<{ slot_id: string; display_code: string; dimension_id: string; observation: string; target_agent: string; probe_intent: string }>;
  public_facts: Array<{ id: string; text: string }>;
  role_facts: Record<string, Array<{ id: string; text: string }>>;
  events: Array<{ id: string; round: number; agent: string; facts: Array<{ id: string; text: string }> }>;
  round_policy: { min: number; max: number };
}

export interface ScenarioBriefInput {
  title: string;
  industry?: string;
  user_role: string;
  scenario_desc: string;
  job_requirements?: string;
  focus_dimensions?: string[];
  extra_notes?: string;
  max_round?: number;
  roles?: { leader?: { name?: string; hint?: string }; coworker?: { name?: string; hint?: string }; client?: { name?: string; hint?: string } };
  weights_input?: Record<string, unknown>;
}

export interface GenerateScenarioResponse {
  scenario: AdminScenario;
  definition: ScenarioDefinition;
  weights: DimensionWeights;
  generated_by: "model" | "template";
  attempts: number;
  warnings?: string[];
}

export interface ScenarioDetailResponse {
  scenario: AdminScenario;
  definition: ScenarioDefinition | null;
  weights: DimensionWeights;
  brief?: ScenarioBriefInput | null;
}

export interface ReviseScenarioResponse {
  scenario: AdminScenario;
  definition: ScenarioDefinition;
  weights: DimensionWeights;
  generated_by: "model" | "template" | "document";
  applied?: { document_changes: string[]; instruction: string };
}

export interface PromptTemplate {
  id: string;
  key: string;
  name: string;
  content: string;
  version: number;
  active: boolean;
  updatedAt: string;
}

export interface AdminSession {
  id: string;
  status: string;
  round: number;
  totalScore?: number | null;
  startedAt: string;
  endedAt?: string | null;
  user?: { nickname?: string | null } | null;
  scenario: Scenario;
}

export interface AdminSessionDetail {
  session: AdminSession;
  messages: Message[];
  report?: Report | null;
}

export interface DashboardData {
  total_sessions: number;
  completed_sessions: number;
  running_sessions: number;
  groups?: Array<{ scenario_id: string; assessment_version: string; model_config: string; count: number; average_score: number; average_dimension_scores: Record<string, number> }>;
}
