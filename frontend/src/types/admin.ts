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
