import { request } from "./client";
import type {
  Scenario,
  SendMessageResponse,
  SessionDetail,
  StartAssessmentResponse,
  Report,
  ReportProgressEvent,
  AgentTraceEvent
} from "../types/assessment";

export function listScenarios() {
  return request<Scenario[]>("/api/assessment/scenarios");
}

export function startAssessment(input: { scenario_id?: string; nickname?: string }) {
  return request<StartAssessmentResponse>("/api/assessment/start", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getSession(sessionId: string) {
  return request<SessionDetail>(`/api/assessment/session/${sessionId}`);
}

export function sendMessage(sessionId: string, content: string) {
  return request<SendMessageResponse>("/api/assessment/message", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, content })
  });
}

/**
 * 报告可能来自不同版本的 Judge 输出（字段缺失、类型不符、旧版本落库），
 * 渲染层大量依赖数组与对象字段，缺失会导致整页崩溃。
 * 在 API 边界统一补齐，保证渲染层拿到的始终是完整结构。
 */
export function normalizeReport(raw: unknown): Report {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const asRecord = <T,>(v: unknown): Record<string, T> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, T>) : {};

  const coverage = asRecord<unknown>(r.coverage_status);
  const sampling = asRecord<unknown>(r.sampling_stats);
  const hasCoverage = Object.keys(coverage).length > 0;
  const hasSampling = Object.keys(sampling).length > 0;

  const evidence = asArray<Record<string, unknown>>(r.evidence).map((item) => ({
    dimension: typeof item?.dimension === "string" ? item.dimension : "",
    quote: typeof item?.quote === "string" ? item.quote : "",
    analysis: typeof item?.analysis === "string" ? item.analysis : ""
  }));

  const dimensionScores = asRecord<number>(r.dimension_scores);
  const radar = asArray<Record<string, unknown>>(r.radar_chart_data).map((item) => ({
    name: typeof item?.name === "string" ? item.name : "",
    score: typeof item?.score === "number" ? item.score : 0,
    max: typeof item?.max === "number" ? item.max : 20
  }));

  return {
    ...(r as unknown as Report),
    total_score: typeof r.total_score === "number" ? r.total_score : 0,
    level: typeof r.level === "string" ? r.level : "无法评分",
    dimension_scores: dimensionScores,
    dimension_analysis: asRecord<string>(r.dimension_analysis),
    conflict_style: typeof r.conflict_style === "string" ? r.conflict_style : "无法判断",
    summary: typeof r.summary === "string" ? r.summary : "",
    strengths: asArray<string>(r.strengths),
    risks: asArray<string>(r.risks),
    suggestions: asArray<string>(r.suggestions),
    evidence,
    radar_chart_data: radar,
    final_recommendation: typeof r.final_recommendation === "string" ? r.final_recommendation : "",
    calibration_issues: asArray<string>(r.calibration_issues),
    coverage_status: hasCoverage
      ? {
          covered_dimensions: asArray<string>(coverage.covered_dimensions),
          insufficient_dimensions: asArray<string>(coverage.insufficient_dimensions),
          complete: Boolean(coverage.complete)
        }
      : undefined,
    sampling_stats: hasSampling
      ? {
          scores: asArray<number>(sampling.scores),
          variance: typeof sampling.variance === "number" ? sampling.variance : 0,
          dim_variances: asRecord<number>(sampling.dim_variances)
        }
      : undefined
  };
}

export function getReport(sessionId: string) {
  return request<Report>(`/api/assessment/report/${sessionId}`).then(normalizeReport);
}

// ── Streaming sendMessage ───────────────────────────────

export interface StreamEvents {
  onSpeaker: (speaker: string, role: string) => void;
  onToken: (token: string) => void;
  onAgentTrace?: (event: AgentTraceEvent) => void;
  onHandoff?: (payload: Record<string, unknown>) => void;
  onJudging?: () => void;
  onReportProgress?: (progress: ReportProgressEvent) => void;
  onDone: (result: SendMessageResponse) => void;
  onError: (message: string) => void;
}

function parseStreamData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export async function sendMessageStream(
  sessionId: string,
  content: string,
  events: StreamEvents
): Promise<void> {
  const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();
  const apiBase = configuredApiBase ? configuredApiBase.replace(/\/$/, "") : "";
  const url = `${apiBase}/api/assessment/message/stream`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, content })
  });

  if (!response.ok) {
    const text = await response.text();
    events.onError(`HTTP ${response.status}: ${text}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    events.onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let completed = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEvent = "";
          continue;
        }

        if (trimmed.startsWith("event: ")) {
          currentEvent = trimmed.slice(7);
          continue;
        }

        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          const parsed = parseStreamData(data);

          if (currentEvent === "speaker") {
            if (parsed && typeof parsed === "object" && "speaker" in parsed && "role" in parsed) {
              const speakerEvent = parsed as { speaker?: unknown; role?: unknown };
              events.onSpeaker(String(speakerEvent.speaker ?? ""), String(speakerEvent.role ?? ""));
            }
          } else if (currentEvent === "judging") {
            events.onJudging?.();
          } else if (currentEvent === "agent_trace") {
            if (parsed && typeof parsed === "object" && "nodeId" in parsed && "status" in parsed) {
              events.onAgentTrace?.(parsed as AgentTraceEvent);
            }
          } else if (currentEvent === "handoff") {
            if (parsed && typeof parsed === "object") {
              events.onHandoff?.(parsed as Record<string, unknown>);
            }
          } else if (currentEvent === "report_progress") {
            if (parsed && typeof parsed === "object" && "stage" in parsed && "message" in parsed) {
              const progress = parsed as Partial<ReportProgressEvent>;
              events.onReportProgress?.({
                stage: String(progress.stage ?? "preparing"),
                message: String(progress.message ?? "报告生成中"),
                percent: typeof progress.percent === "number" ? progress.percent : 0,
                current: typeof progress.current === "number" ? progress.current : undefined,
                total: typeof progress.total === "number" ? progress.total : undefined,
                elapsedMs: typeof progress.elapsedMs === "number" ? progress.elapsedMs : undefined,
                delayed: Boolean(progress.delayed)
              });
            }
          } else if (currentEvent === "token") {
            events.onToken(typeof parsed === "string" ? parsed : String(parsed ?? ""));
          } else if (currentEvent === "done") {
            completed = true;
            if (parsed && typeof parsed === "object") {
              events.onDone(parsed as SendMessageResponse);
            } else {
              events.onError("Failed to parse done event");
            }
          } else if (currentEvent === "error") {
            completed = true;
            if (parsed && typeof parsed === "object" && "error" in parsed) {
              events.onError(String((parsed as { error?: unknown }).error ?? "Unknown error"));
            } else {
              events.onError(typeof parsed === "string" ? parsed : "Unknown error");
            }
          }
          currentEvent = "";
        }
      }
    }
  } catch (error) {
    if (!completed) {
      completed = true;
      events.onError(error instanceof Error ? error.message : "Stream connection failed");
    }
  }

  if (!completed) {
    events.onError("Stream closed before completion");
  }
}
