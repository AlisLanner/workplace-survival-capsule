export type AgentName = "leader" | "coworker" | "client";
export type GraphNodeStatus = "pending" | "running" | "completed" | "skipped" | "failed";

export interface AgentCapabilityCard {
  name: string;
  role: string;
  visibleContext: string[];
  handoffTargets: string[];
  guardrails: string[];
  outputSchema: string;
}

export interface AgentTraceEvent {
  id: string;
  sessionId: string;
  runId: string;
  nodeId: string;
  agentName: string;
  eventType: "node" | "handoff" | "guardrail" | "tool" | "error" | string;
  status: GraphNodeStatus;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  elapsedMs?: number | null;
  sequence: number;
  createdAt: string;
}

export interface AssessmentGraphState {
  runId: string;
  session: unknown;
  scenario: unknown;
  messages: unknown[];
  userMessage: string;
  blackboard: unknown;
  directorResult?: DirectorResult;
  groupResult?: GroupDiscussionResult | null;
  activeAgent?: AgentName;
  npcResult?: NpcResult;
  report?: unknown;
  traceEvents: AgentTraceEvent[];
}

export interface VisibleReply {
  speaker: string;
  role: string;
  content: string;
}

export interface DirectorResult {
  active_agent: AgentName;
  phase: string;
  pressure_level: number;
  current_focus: string;
  detected_behavior?: Record<string, boolean>;
  dimension_evidence?: Array<{
    dimension: string;
    quality: "none" | "partial" | "clear" | string;
    quote?: string;
    reason?: string;
  }>;
  npc_instruction: string;
  trigger_group_discussion?: boolean;
  should_finish?: boolean;
  finish_reason?: string;
  updated_blackboard_patch?: Record<string, unknown>;
}

export interface BehaviorDetectionResult {
  detected_behavior: Record<string, boolean>;
  evidence: Array<{
    behavior: string;
    quote: string;
    reason: string;
  }>;
  dimension_evidence?: Array<{
    dimension: string;
    quality: "none" | "partial" | "clear" | string;
    quote: string;
    reason: string;
  }>;
  summary?: string;
}

export interface StageDirectorResult {
  active_agent: AgentName;
  phase: string;
  pressure_level: number;
  current_focus: string;
  npc_instruction: string;
  trigger_group_discussion?: boolean;
  should_finish?: boolean;
  finish_reason?: string;
  updated_blackboard_patch?: Record<string, unknown>;
}

export interface NpcResult {
  visible_reply: VisibleReply;
  memory_update?: Record<string, unknown>;
}

export interface GroupDiscussionResult {
  no_change?: boolean;
  conflicts?: Array<{
    type?: string;
    description?: string;
    severity?: "low" | "medium" | "high" | string;
  }>;
  memory_conflicts?: Array<{
    description?: string;
    severity?: "low" | "medium" | "high" | string;
  }>;
  correction?: {
    next_agent?: AgentName;
    next_focus?: string;
    instruction?: string;
    blackboard_patch?: Record<string, unknown>;
  } | null;
  audit_notes?: string[];
  leader_view?: Record<string, unknown>;
  coworker_view?: Record<string, unknown>;
  client_view?: Record<string, unknown>;
  director_decision?: {
    next_agent?: AgentName;
    next_focus?: string;
    instruction?: string;
  };
  blackboard_patch?: Record<string, unknown>;
}

export interface JudgeReport {
  total_score: number;
  level: string;
  dimension_scores: Record<string, number>;
  dimension_analysis: Record<string, string>;
  conflict_style: string;
  summary: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  evidence: Array<{
    dimension: string;
    quote: string;
    analysis: string;
  }>;
  radar_chart_data: Array<{
    name: string;
    score: number;
    max: number;
  }>;
  final_recommendation: string;
  calibration_issues?: string[];
  human_review_required?: boolean;
  human_review_reason?: string;
  mock_generated?: boolean;
  report_status?: "confident" | "provisional" | "unratable" | "debug";
  coverage_status?: {
    covered_dimensions: string[];
    insufficient_dimensions: string[];
    complete: boolean;
  };
}
