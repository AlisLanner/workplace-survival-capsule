import { request } from "./client";
import { getAdminToken } from "../components/AdminGate";
import { normalizeReport } from "./assessment.api";
import type {
  DashboardData,
  AdminSession,
  AdminSessionDetail,
  AdminScenario,
  GenerateScenarioResponse,
  PromptTemplate,
  ReviseScenarioResponse,
  ScenarioDetailResponse,
  ScenarioBriefInput,
  UpdateWeightsResponse
} from "../types/admin";
import type { Scenario } from "../types/assessment";

function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  if (!token) return {};
  return { "x-admin-secret": token };
}

export function verifyAdminToken(token: string) {
  return request<{ ok: boolean }>("/api/admin/verify", { headers: { "x-admin-secret": token } });
}

export function getDashboard() {
  return request<DashboardData>("/api/admin/dashboard", { headers: adminHeaders() });
}

export function listAdminScenarios() {
  return request<AdminScenario[]>("/api/admin/scenarios", { headers: adminHeaders() });
}

export function updateAdminScenario(id: string, data: Partial<Scenario>) {
  return request<Scenario>(`/api/admin/scenarios/${id}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify(data)
  });
}

export function createSimpleScenario(data: { title: string; description?: string; backgroundForUser?: string; maxRound?: number }) {
  return request<AdminScenario>("/api/admin/scenarios", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(data)
  });
}

export function generateScenario(brief: ScenarioBriefInput) {
  return request<GenerateScenarioResponse>("/api/admin/scenarios/generate", {
    method: "POST",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(brief)
  });
}

export function getScenarioDetail(id: string) {
  return request<ScenarioDetailResponse>(`/api/admin/scenarios/${id}`, { headers: adminHeaders() });
}

export function updateScenarioWeights(id: string, body: Record<string, unknown>) {
  return request<UpdateWeightsResponse>(`/api/admin/scenarios/${id}/weights`, {
    method: "PUT",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export function deleteAdminScenario(id: string) {
  return request<{ deleted: string }>(`/api/admin/scenarios/${id}`, {
    method: "DELETE",
    headers: adminHeaders()
  });
}

export function reviseScenario(id: string, body: { instruction?: string; markdown?: string }) {
  return request<ReviseScenarioResponse>(`/api/admin/scenarios/${id}/revise`, {
    method: "POST",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export function exportScenarioDocument(id: string) {
  return request<{ markdown: string; filename: string }>(`/api/admin/scenarios/${id}/document`, { headers: adminHeaders() });
}

export function importScenarioDocument(id: string, markdown: string) {
  return request<ReviseScenarioResponse>(`/api/admin/scenarios/${id}/document`, {
    method: "POST",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ markdown })
  });
}

export function listPrompts() {
  return request<PromptTemplate[]>("/api/admin/prompts", { headers: adminHeaders() });
}

export function updatePrompt(key: string, data: Partial<Pick<PromptTemplate, "content" | "name" | "active">>) {
  return request<PromptTemplate>(`/api/admin/prompts/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify(data)
  });
}

export function listSessions() {
  return request<AdminSession[]>("/api/admin/sessions", { headers: adminHeaders() });
}

export function getAdminSessionDetail(id: string) {
  return request<AdminSessionDetail>(`/api/admin/sessions/${id}`, { headers: adminHeaders() }).then(
    (detail) => ({
      ...detail,
      report: detail.report ? normalizeReport(detail.report) : null,
      agent_trace: Array.isArray(detail.agent_trace) ? detail.agent_trace : [],
      group_discussions: Array.isArray(detail.group_discussions) ? detail.group_discussions : [],
      messages: Array.isArray(detail.messages) ? detail.messages : []
    })
  );
}
