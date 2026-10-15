import { prisma } from "../db/prisma";
import {
  normalizeDiscussion,
  normalizeScenario,
  normalizeSession,
  normalizeTraceEvent,
  parseJsonField,
  stringifyJson
} from "../utils/jsonField";
import { createInitialBlackboard, type Blackboard } from "./blackboard.service";
import { runAssessmentTurn, runAssessmentTurnStreaming, type StreamingTurnEvents } from "./orchestrator.service";
import type { VisibleReply } from "../types/agent";

export interface StartAssessmentInput {
  user_id?: string;
  nickname?: string;
  scenario_id?: string;
}

interface ScenarioRuntimeConfig {
  id: string;
  maxRound: number;
  openingMessageJson?: string | null;
  initialBlackboardJson?: string | null;
}

const fallbackOpeningMessage: VisibleReply = {
  speaker: "测评系统",
  role: "开场",
  content: "你先说说，你会怎么处理。"
};

function resolveOpeningMessage(scenario: ScenarioRuntimeConfig): VisibleReply {
  return parseJsonField<VisibleReply | null>(scenario.openingMessageJson, null) ?? fallbackOpeningMessage;
}

function resolveInitialBlackboard(scenario: ScenarioRuntimeConfig): Blackboard {
  const configured = parseJsonField<Blackboard | null>(scenario.initialBlackboardJson, null);
  if (configured) {
    return {
      ...configured,
      max_round: scenario.maxRound
    };
  }

  return createInitialBlackboard(scenario.maxRound, scenario.id);
}

async function resolveUser(input: StartAssessmentInput): Promise<string | undefined> {
  if (!input.user_id && !input.nickname) {
    return undefined;
  }

  if (input.user_id) {
    const user = await prisma.user.upsert({
      where: { id: input.user_id },
      create: { id: input.user_id, nickname: input.nickname },
      update: input.nickname ? { nickname: input.nickname } : {}
    });
    return user.id;
  }

  const user = await prisma.user.create({
    data: { nickname: input.nickname }
  });
  return user.id;
}

export async function listActiveScenarios() {
  const scenarios = await prisma.scenario.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "asc" }
  });
  return scenarios.map(normalizeScenario);
}

export async function startAssessment(input: StartAssessmentInput) {
  const scenario = input.scenario_id
    ? await prisma.scenario.findUnique({ where: { id: input.scenario_id } })
    : await prisma.scenario.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" } });

  if (!scenario || scenario.status !== "active") {
    throw new Error("Scenario not found or inactive");
  }

  const userId = await resolveUser(input);
  const blackboard = resolveInitialBlackboard(scenario);
  const openingMessage = resolveOpeningMessage(scenario);

  const session = await prisma.assessmentSession.create({
    data: {
      userId,
      scenarioId: scenario.id,
      blackboardState: stringifyJson(blackboard),
      groupChatSummary: stringifyJson({})
    }
  });

  await prisma.message.create({
    data: {
      sessionId: session.id,
      senderType: "agent",
      senderName: openingMessage.speaker,
      senderRole: openingMessage.role,
      content: openingMessage.content,
      roundIndex: 0
    }
  });

  return {
    session_id: session.id,
    opening_message: openingMessage,
    blackboard,
    scenario: normalizeScenario(scenario)
  };
}

export async function sendAssessmentMessage(sessionId: string, content: string) {
  const cleanContent = content.trim();
  if (!cleanContent) {
    throw new Error("Message content is required");
  }

  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      user: true,
      messages: { orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }] }
    }
  });

  if (!session) {
    throw new Error("Session not found");
  }

  return runAssessmentTurn({
    session: {
      ...session,
      nickname: session.user?.nickname ?? undefined,
      blackboardState: parseJsonField<Blackboard>(
        session.blackboardState,
        resolveInitialBlackboard(session.scenario)
      ),
      reportJson: parseJsonField<Record<string, unknown> | null>(session.reportJson, null),
      groupChatSummary: parseJsonField<Record<string, unknown> | null>(session.groupChatSummary, null)
    },
    scenario: normalizeScenario(session.scenario),
    messages: session.messages,
    userMessage: cleanContent
  });
}

export async function getAssessmentSession(sessionId: string) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
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
    session: normalizedSession,
    scenario: normalizeScenario(session.scenario),
    messages: session.messages,
    group_discussions: session.groupDiscussions.map(normalizeDiscussion),
    agent_trace: session.agentTraceEvents.map(normalizeTraceEvent),
    report: normalizedSession.reportJson
  };
}

export async function getAssessmentReport(sessionId: string) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const report = parseJsonField<Record<string, unknown> | null>(session.reportJson, null);
  if (!report) {
    throw new Error("Report has not been generated yet");
  }

  return report;
}

// ── Streaming sendMessage ──────────────────────────────

export async function sendAssessmentMessageStreaming(
  sessionId: string,
  content: string,
  events: StreamingTurnEvents
): Promise<void> {
  const cleanContent = content.trim();
  if (!cleanContent) {
    events.onError("Message content is required");
    return;
  }

  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      user: true,
      messages: { orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }] }
    }
  });

  if (!session) {
    events.onError("Session not found");
    return;
  }

  await runAssessmentTurnStreaming({
    session: {
      ...session,
      nickname: session.user?.nickname ?? undefined,
      blackboardState: parseJsonField<Blackboard>(
        session.blackboardState,
        resolveInitialBlackboard(session.scenario)
      ),
      reportJson: parseJsonField<Record<string, unknown> | null>(session.reportJson, null),
      groupChatSummary: parseJsonField<Record<string, unknown> | null>(session.groupChatSummary, null)
    },
    scenario: normalizeScenario(session.scenario),
    messages: session.messages,
    userMessage: cleanContent,
    events
  });
}
