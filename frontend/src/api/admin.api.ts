import { request } from "./client";
import { getAdminToken } from "../components/AdminGate";
import { normalizeReport } from "./assessment.api";
import type { DashboardData, AdminSession, AdminSessionDetail, PromptTemplate } from "../types/admin";
import type { Scenario } from "../types/assessment";

function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  if (!token) return {};
  return { "x-admin-secret": token };
}

export function getDashboard() {
  return request<DashboardData>("/api/admin/dashboard", { headers: adminHeaders() });
}

export function listAdminScenarios() {
  return request<Scenario[]>("/api/admin/scenarios", { headers: adminHeaders() });
}

export function updateAdminScenario(id: string, data: Partial<Scenario>) {
  return request<Scenario>(`/api/admin/scenarios/${id}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify(data)
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

