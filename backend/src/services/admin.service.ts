import { prisma } from "../db/prisma";
import {
  normalizeDiscussion,
  normalizeScenario,
  normalizeSession,
  normalizeTraceEvent,
  parseJsonField,
  stringifyJson
} from "../utils/jsonField";

type ReportShape = {
  dimension_scores?: Record<string, number>;
};

const currentDashboardDimensions = [
  "信息辨别",
  "交付切分",
  "备选方案",
  "承诺边界",
  "向上对齐",
  "横向协商",
  "新人赋能",
  "压力表达",
  "利害识别",
  "现场止损",
  "规则边界",
  "面子修复",
  "员工修复",
  "后厨协同",
  "系统改进"
];

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

export async function getDashboardData() {
  const [totalSessions, completedSessions, runningSessions, finishedSessions] = await Promise.all([
    prisma.assessmentSession.count(),
    prisma.assessmentSession.count({ where: { status: "finished" } }),
    prisma.assessmentSession.count({ where: { status: "running" } }),
    prisma.assessmentSession.findMany({
      where: { status: "finished" },
      select: { totalScore: true, reportJson: true }
    })
  ]);

  const reports = finishedSessions.map((session) =>
    parseJsonField<ReportShape | null>(session.reportJson, null)
  );
  // 后台总览只聚合当前测评体系维度，历史报告中的旧维度不进入“维度均分”。
  const dimensions = currentDashboardDimensions.filter((dimension) =>
    reports.some((report) => typeof report?.dimension_scores?.[dimension] === "number")
  );
  const averageDimensionScores: Record<string, number> = {};

  for (const dimension of dimensions) {
    averageDimensionScores[dimension] = average(
      reports
        .map((report) => report?.dimension_scores?.[dimension])
        .filter((score): score is number => typeof score === "number")
    );
  }

  return {
    total_sessions: totalSessions,
    completed_sessions: completedSessions,
    running_sessions: runningSessions,
    average_score: average(
      finishedSessions
        .map((session) => session.totalScore)
        .filter((score): score is number => typeof score === "number")
    ),
    average_dimension_scores: averageDimensionScores
  };
}

export async function listScenarios() {
  const scenarios = await prisma.scenario.findMany({
    orderBy: { createdAt: "asc" }
  });
  return scenarios.map(normalizeScenario);
}

export async function updateScenario(id: string, data: Record<string, unknown>) {
  const allowed = {
    title: data.title,
    description: data.description,
    backgroundForUser: data.backgroundForUser,
    maxRound: data.maxRound,
    groupChatEnabled: data.groupChatEnabled,
    groupChatRounds: data.groupChatRounds === undefined ? undefined : stringifyJson(data.groupChatRounds),
    status: data.status
  };

  const scenario = await prisma.scenario.update({
    where: { id },
    data: Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined))
  });

  return normalizeScenario(scenario);
}

export async function listPrompts() {
  return prisma.promptTemplate.findMany({
    orderBy: [{ key: "asc" }, { version: "desc" }]
  });
}

export async function updatePrompt(key: string, data: { content?: string; name?: string; active?: boolean }) {
  const current = await prisma.promptTemplate.findUnique({ where: { key } });
  if (!current) {
    throw new Error("Prompt template not found");
  }

  return prisma.promptTemplate.update({
    where: { key },
    data: {
      name: data.name ?? current.name,
      content: data.content ?? current.content,
      active: data.active ?? current.active,
      version: { increment: data.content && data.content !== current.content ? 1 : 0 }
    }
  });
}

const ABANDONED_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function listSessions() {
  const sessions = await prisma.assessmentSession.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      user: true,
      scenario: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } }
    }
  });

  // Auto-abandon sessions that are "running" with no activity for > 30 minutes
  const now = Date.now();
  const abandonedIds: string[] = [];

  for (const session of sessions) {
    if (session.status !== "running") continue;
    const lastActivity =
      session.messages.length > 0
        ? new Date(session.messages[0].createdAt).getTime()
        : new Date(session.startedAt).getTime();
    if (now - lastActivity > ABANDONED_TIMEOUT_MS) {
      abandonedIds.push(session.id);
    }
  }

  if (abandonedIds.length > 0) {
    await prisma.assessmentSession.updateMany({
      where: { id: { in: abandonedIds } },
      data: { status: "abandoned", endedAt: new Date() }
    });
  }

  return sessions.map((session) => ({
    ...normalizeSession(session),
    status: abandonedIds.includes(session.id) ? "abandoned" : session.status,
    scenario: normalizeScenario(session.scenario)
  }));
}

export async function getSessionDetail(sessionId: string) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
      scenario: true,
      messages: { orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }] },
      groupDiscussions: { orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }] },
      agentTraceEvents: { orderBy: [{ sequence: "asc" }, { createdAt: "asc" }] }
    }
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const normalizedSession = normalizeSession(session);

  return {
    session: {
      ...normalizedSession,
      scenario: normalizeScenario(session.scenario)
    },
    messages: session.messages,
    group_discussions: session.groupDiscussions.map(normalizeDiscussion),
    agent_trace: session.agentTraceEvents.map(normalizeTraceEvent),
    report: normalizedSession.reportJson
  };
}
