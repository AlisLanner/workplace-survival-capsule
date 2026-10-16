export interface Scenario {
  assessmentVersion?: string|null;
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
  assessment_version?: string;
  schema_version?: string;
  scenario_id?: string;
  dimension_results?: Array<{
    id:string;name:string;score:number|null;status:"rated"|"not_observed"|"insufficient"|"scoring_failed";analysis:string;
    slot_results:Array<{slot_id:string;sufficiency:string;valence:string|null;opportunity:Array<{question_message_id:string;fact_ids:string[];round:number}>;evidence:Array<{message_id:string;quote:string;reason:string;response_context?:{question_message_id:string;answered_opportunities:number}}>}>;
  }>;
  review_reasons?: string[];
  assessment_meta?: Record<string,unknown>;
  total_score: number|null;
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
    variance: number|null;
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
