/** 正式 API 客户端：同源相对路径 /api，由 Next rewrites 转发到 Express 后端。 */
import type {
  AdminScenario, AdminSession, AdminSessionDetail, DashboardData,
  GenerateScenarioResponse, PromptTemplate, Report, ReportProgressEvent,
  ReviseScenarioResponse, Scenario, ScenarioBriefInput, ScenarioDetailResponse,
  SendMessageResponse, SessionDetail, StartAssessmentResponse
} from "./types";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error || `请求失败（HTTP ${response.status}）`;
    throw new ApiError(message, response.status);
  }
  return data as T;
}

// ── 管理口令 ─────────────────────────────────────────────
const TOKEN_KEY = "maat_admin_token";
export function getAdminToken(): string {
  try { return sessionStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
}
export function setAdminToken(token: string) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearAdminToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}
function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { "x-admin-secret": token } : {};
}

// ── 候选人端 ─────────────────────────────────────────────
export const listScenarios = () => request<Scenario[]>("/api/assessment/scenarios");
export const startAssessment = (input: { scenario_id: string; nickname: string }) =>
  request<StartAssessmentResponse>("/api/assessment/start", { method: "POST", body: JSON.stringify(input) });
export const getSession = (sessionId: string) =>
  request<SessionDetail>(`/api/assessment/session/${sessionId}`);
export const getReport = (sessionId: string) =>
  request<Report>(`/api/assessment/report/${sessionId}`).then(normalizeReport);

/**
 * 报告可能来自不同版本的 Judge 输出（字段缺失、类型不符、旧版本落库），
 * 在 API 边界统一补齐，保证渲染层拿到的始终是完整结构（沿用正式程序口径）。
 */
export function normalizeReport(raw: unknown): Report {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (r.assessment_version) {
    if (r.schema_version !== "ge8/1" || !Array.isArray(r.dimension_results) || (r.dimension_results as unknown[]).length !== 8) {
      throw new Error("报告版本或八维结构无法识别，请保留记录并联系管理员复核。");
    }
    return r as unknown as Report;
  }
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const asRecord = <T,>(v: unknown): Record<string, T> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, T>) : {});
  return {
    ...(r as unknown as Report),
    total_score: typeof r.total_score === "number" ? r.total_score : 0,
    level: typeof r.level === "string" ? r.level : "无法评分",
    dimension_scores: asRecord<number>(r.dimension_scores),
    dimension_analysis: asRecord<string>(r.dimension_analysis),
    conflict_style: typeof r.conflict_style === "string" ? r.conflict_style : "无法判断",
    summary: typeof r.summary === "string" ? r.summary : "",
    strengths: asArray<string>(r.strengths),
    risks: asArray<string>(r.risks),
    suggestions: asArray<string>(r.suggestions),
    evidence: asArray<Record<string, unknown>>(r.evidence).map(item => ({
      dimension: typeof item?.dimension === "string" ? item.dimension : "",
      quote: typeof item?.quote === "string" ? item.quote : "",
      analysis: typeof item?.analysis === "string" ? item.analysis : ""
    })),
    radar_chart_data: asArray<Record<string, unknown>>(r.radar_chart_data).map(item => ({
      name: typeof item?.name === "string" ? item.name : "",
      score: typeof item?.score === "number" ? item.score : 0,
      max: typeof item?.max === "number" ? item.max : 20
    })),
    final_recommendation: typeof r.final_recommendation === "string" ? r.final_recommendation : ""
  };
}

// ── 流式作答（SSE 透传） ─────────────────────────────────
export interface StreamEvents {
  onSpeaker: (speaker: string, role: string) => void;
  onToken: (token: string) => void;
  onJudging?: () => void;
  onReportProgress?: (progress: ReportProgressEvent) => void;
  onDone: (result: SendMessageResponse) => void;
  onError: (message: string) => void;
}

export async function sendMessageStream(sessionId: string, content: string, events: StreamEvents): Promise<void> {
  const response = await fetch("/api/assessment/message/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, content })
  });
  if (!response.ok) {
    const text = await response.text();
    let message = `HTTP ${response.status}`;
    try { message = JSON.parse(text)?.error || message; } catch { /* keep */ }
    events.onError(message);
    return;
  }
  const reader = response.body?.getReader();
  if (!reader) { events.onError("No response body"); return; }
  const decoder = new TextDecoder();
  let buffer = "", currentEvent = "", completed = false;
  const parse = (data: string): unknown => { try { return JSON.parse(data); } catch { return data; } };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { currentEvent = ""; continue; }
        if (trimmed.startsWith("event: ")) { currentEvent = trimmed.slice(7); continue; }
        if (!trimmed.startsWith("data: ")) continue;
        const parsed = parse(trimmed.slice(6));
        if (currentEvent === "speaker") {
          const speakerEvent = parsed as { speaker?: unknown; role?: unknown };
          events.onSpeaker(String(speakerEvent?.speaker ?? ""), String(speakerEvent?.role ?? ""));
        } else if (currentEvent === "judging") events.onJudging?.();
        else if (currentEvent === "report_progress") {
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
        } else if (currentEvent === "token") {
          events.onToken(typeof parsed === "string" ? parsed : String(parsed ?? ""));
        } else if (currentEvent === "done") {
          completed = true;
          if (parsed && typeof parsed === "object") events.onDone(parsed as SendMessageResponse);
          else events.onError("Failed to parse done event");
        } else if (currentEvent === "error") {
          completed = true;
          events.onError(parsed && typeof parsed === "object" ? String((parsed as { error?: unknown }).error ?? "Unknown error") : String(parsed ?? "Unknown error"));
        }
        currentEvent = "";
      }
    }
  } catch (error) {
    if (!completed) { completed = true; events.onError(error instanceof Error ? error.message : "Stream connection failed"); }
  }
  if (!completed) events.onError("Stream closed before completion");
}

// ── 管理端 ─────────────────────────────────────────────
export const verifyAdmin = (token: string) =>
  request<{ ok: boolean }>("/api/admin/verify", { headers: { "x-admin-secret": token } });
export const getDashboard = () => request<DashboardData>("/api/admin/dashboard", { headers: adminHeaders() });
export const listAdminScenarios = () => request<AdminScenario[]>("/api/admin/scenarios", { headers: adminHeaders() });
export const getScenarioDetail = (id: string) =>
  request<ScenarioDetailResponse>(`/api/admin/scenarios/${id}`, { headers: adminHeaders() });
export const updateAdminScenario = (id: string, data: Record<string, unknown>) =>
  request<Scenario>(`/api/admin/scenarios/${id}`, { method: "PUT", headers: adminHeaders(), body: JSON.stringify(data) });
export const deleteAdminScenario = (id: string) =>
  request<{ deleted: string }>(`/api/admin/scenarios/${id}`, { method: "DELETE", headers: adminHeaders() });
export const updateScenarioWeights = (id: string, body: Record<string, unknown>) =>
  request<{ weights: ScenarioDetailResponse["weights"]; note?: string }>(`/api/admin/scenarios/${id}/weights`, { method: "PUT", headers: adminHeaders(), body: JSON.stringify(body) });
export const generateScenario = (brief: ScenarioBriefInput) =>
  request<GenerateScenarioResponse>("/api/admin/scenarios/generate", { method: "POST", headers: adminHeaders(), body: JSON.stringify(brief) });
export const reviseScenario = (id: string, body: { instruction?: string; markdown?: string }) =>
  request<ReviseScenarioResponse>(`/api/admin/scenarios/${id}/revise`, { method: "POST", headers: adminHeaders(), body: JSON.stringify(body) });
export const exportScenarioDocument = (id: string) =>
  request<{ markdown: string; filename: string }>(`/api/admin/scenarios/${id}/document`, { headers: adminHeaders() });
export const importScenarioDocument = (id: string, markdown: string) =>
  request<ReviseScenarioResponse>(`/api/admin/scenarios/${id}/document`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ markdown }) });
export const listPrompts = () => request<PromptTemplate[]>("/api/admin/prompts", { headers: adminHeaders() });
export const updatePrompt = (key: string, data: { content?: string; name?: string; active?: boolean }) =>
  request<PromptTemplate>(`/api/admin/prompts/${encodeURIComponent(key)}`, { method: "PUT", headers: adminHeaders(), body: JSON.stringify(data) });
export const listSessions = () => request<AdminSession[]>("/api/admin/sessions", { headers: adminHeaders() });
export const getAdminSessionDetail = (id: string) =>
  request<AdminSessionDetail>(`/api/admin/sessions/${id}`, { headers: adminHeaders() });
export const retryScoring = (id: string) =>
  request<unknown>(`/api/admin/sessions/${id}/retry-scoring`, { method: "POST", headers: adminHeaders() });
export const recoverTurn = (id: string) =>
  request<unknown>(`/api/admin/sessions/${id}/recover-turn`, { method: "POST", headers: adminHeaders() });
