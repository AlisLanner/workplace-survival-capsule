import type { AgentTraceEvent, GroupDiscussion, Message, Report, Scenario } from "./assessment";

export interface DashboardData {
  total_sessions: number;
  completed_sessions: number;
  running_sessions: number;
  average_score: number|null;
  groups?: Array<{scenario_id:string;assessment_version:string;model_config:string;count:number;average_score:number;average_dimension_scores:Record<string,number>}>;
  average_dimension_scores: Record<string, number>;
}

export interface PromptTemplate {
  id: string;
  key: string;
  name: string;
  content: string;
  version: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSession {
  assessmentVersion?:string|null;
  id: string;
  status: string;
  round: number;
  totalScore?: number | null;
  startedAt: string;
  endedAt?: string | null;
  user?: { id: string; nickname?: string | null } | null;
  scenario: Scenario;
}

export interface AdminSessionDetail {
  assessment_audit?: Record<string,unknown>|null;
  session: AdminSession & {
    blackboardState: Record<string, unknown>;
  };
  messages: Message[];
  group_discussions: GroupDiscussion[];
  agent_trace: AgentTraceEvent[];
  report?: Report | null;
}

// ── 八维权重与自定义场景 ─────────────────────────────────────────

export type DimensionId = "GE01" | "GE02" | "GE03" | "GE04" | "GE05" | "GE06" | "GE07" | "GE08";

export interface DimensionWeights {
  mode: "equal" | "importance" | "numeric" | "free_text";
  weights: Record<DimensionId, number>;
  importance?: Record<DimensionId, number>;
  free_text?: Record<DimensionId, string>;
  numeric_input?: Record<DimensionId, number>;
  note?: string;
  updated_at: string;
}

export interface AdminScenario extends Scenario {
  origin?: string;
  sessionCount?: number;
  dimensionWeights?: DimensionWeights;
  weightsCustomized?: boolean;
}

export interface ScenarioDefinition {
  assessment_version: string;
  scenario_code: string;
  title: string;
  user_role: string;
  dimensions: Array<{ id: DimensionId; name: string; meaning: string }>;
  roles: Record<string, { name: string; role: string }>;
  slots: Array<{
    slot_id: string;
    display_code: string;
    dimension_id: DimensionId;
    observation: string;
    target_agent: string;
    probe_intent: string;
  }>;
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

export interface UpdateWeightsResponse {
  scenario: Scenario;
  weights: DimensionWeights;
  note?: string;
}
