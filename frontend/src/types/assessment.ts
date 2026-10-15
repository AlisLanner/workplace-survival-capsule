export interface Scenario {
  id: string;
  title: string;
  description: string;
  backgroundForUser: string;
  maxRound: number;
  groupChatEnabled: boolean;
  groupChatRounds: number[];
  status: string;
  openingMessage?: VisibleReply | null;
}

export interface Message {
  id: string;
  sessionId?: string;
  senderType: "user" | "agent" | string;
  senderName: string;
  senderRole?: string | null;
  content: string;
  roundIndex: number;
  createdAt?: string;
}

export interface VisibleReply {
  speaker: string;
  role: string;
  content: string;
}

export type GraphNodeStatus = "pending" | "running" | "completed" | "skipped" | "failed";

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

export interface StartAssessmentResponse {
  session_id: string;
  opening_message: VisibleReply;
  blackboard: Record<string, unknown>;
  scenario: Scenario;
}

export interface SessionDetail {
  session: {
    id: string;
    status: string;
    round: number;
    totalScore?: number | null;
    blackboardState: Record<string, unknown>;
    reportJson?: Report | null;
  };
  scenario: Scenario;
  messages: Message[];
  group_discussions: GroupDiscussion[];
  agent_trace: AgentTraceEvent[];
  report?: Report | null;
}


export interface ReportProgressEvent {
  stage: "preparing" | "judge_sampling" | "aggregating" | "calibrating" | "saving" | "done" | string;
  message: string;
  percent: number;
  current?: number;
  total?: number;
  elapsedMs?: number;
  delayed?: boolean;
}

export interface SendMessageResponse {
  finished: boolean;
  reply: VisibleReply;
  round: number;
  phase: string;
  report?: Report;
  blackboard: Record<string, unknown>;
  agent_trace?: AgentTraceEvent[];
}

export interface Report {
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
  report_status?: "confident" | "provisional" | "unratable" | "debug" | "scoring_failed";
  scoring_error_reason?: string;
  reason?: string;
  coverage_status?: {
    covered_dimensions: string[];
    insufficient_dimensions: string[];
    complete: boolean;
  };
  sampling_stats?: {
    scores: number[];
    variance: number;
    dim_variances?: Record<string, number>;
  };
}

export interface GroupDiscussion {
  id: string;
  roundIndex: number;
  phase: string;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  createdAt: string;
}
