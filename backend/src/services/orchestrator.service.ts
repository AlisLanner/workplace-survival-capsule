import type { Message, Scenario } from "@prisma/client";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { callClientAgent } from "../agents/client.agent";
import { callCoworkerAgent } from "../agents/coworker.agent";
import { callDirectorAgent } from "../agents/director.agent";
import { callGroupDiscussionAgent } from "../agents/groupDiscussion.agent";
import { callJudgeAgent, type JudgeProgressEvent } from "../agents/judge.agent";
import { callLeaderAgent } from "../agents/leader.agent";
import { callNpcAgentStreaming } from "../agents/npc.agent";
import { prisma } from "../db/prisma";
import type {
  AgentName,
  AgentTraceEvent,
  DirectorResult,
  GraphNodeStatus,
  GroupDiscussionResult,
  JudgeReport,
  NpcResult,
  VisibleReply
} from "../types/agent";
import { getAssessmentAgentCapabilityCards } from "./agentCapabilities.service";
import {
  addGroupSummary,
  applyDetectedBehavior,
  type Blackboard,
  mergeBlackboard,
  mergeNpcMemory
} from "./blackboard.service";
import { buildDirectorView, buildGroupDiscussionView, buildJudgeView, buildNpcView } from "./agentView.service";
import { inferScenarioIdFromBlackboard } from "./rubric.service";
import { evaluateResponseQuality, type ResponseQualityGate } from "./responseQuality.service";
import {
  summarizeCoverage,
  updateCoverageFromDimensionEvidence,
  updateCoverageFromLegacyBehavior
} from "./slotTracker.service";
import { formatHistory } from "../utils/formatHistory";
import { shouldForceGroupDiscussion } from "../utils/groupDiscussionTrigger";
import { normalizeTraceEvent, stringifyJson } from "../utils/jsonField";
import { createRequestId, log } from "../utils/logger";

// ── Types ──────────────────────────────────────────────
const VISIBLE_REPLY_STREAM_CHUNK_SIZE = 12;

function emitVisibleReplyChunks(content: string, onToken: (token: string) => void) {
  for (let index = 0; index < content.length; index += VISIBLE_REPLY_STREAM_CHUNK_SIZE) {
    onToken(content.slice(index, index + VISIBLE_REPLY_STREAM_CHUNK_SIZE));
  }
}

const AssessmentGraphAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  turnId: Annotation<string>(),
  startedAt: Annotation<number>(),
  session: Annotation<RuntimeSession>(),
  scenario: Annotation<RuntimeScenario>(),
  messages: Annotation<Message[]>({
    value: (_current, update) => update,
    default: () => []
  }),
  userMessage: Annotation<string>(),
  blackboard: Annotation<Blackboard>(),
  historyText: Annotation<string | undefined>(),
  historyMessages: Annotation<Message[] | undefined>(),
  responseQuality: Annotation<ResponseQualityGate | undefined>(),
  shouldTerminateAsUnratable: Annotation<boolean | undefined>(),
  directorResult: Annotation<DirectorResult | undefined>(),
  groupResult: Annotation<GroupDiscussionResult | null | undefined>(),
  activeAgent: Annotation<AgentName | undefined>(),
  npcInstruction: Annotation<string | undefined>(),
  npcResult: Annotation<NpcResult | undefined>(),
  fullHistory: Annotation<string | undefined>(),
  shouldRunJudge: Annotation<boolean | undefined>(),
  finished: Annotation<boolean | undefined>(),
  reply: Annotation<VisibleReply | undefined>(),
  round: Annotation<number | undefined>(),
  phase: Annotation<string | undefined>(),
  report: Annotation<unknown | undefined>(),
  result: Annotation<RunAssessmentTurnResult | undefined>(),
  traceEvents: Annotation<AgentTraceEvent[]>({
    value: (_current, update) => update,
    default: () => []
  }),
  traceSequence: Annotation<number>({
    value: (_current, update) => update,
    default: () => 0
  })
});

type InternalAssessmentGraphState = typeof AssessmentGraphAnnotation.State;

type RuntimeScenario = Omit<Scenario, "groupChatRounds" | "openingMessageJson" | "initialBlackboardJson"> & {
  groupChatRounds: number[];
};

interface RuntimeSession {
  id: string;
  scenarioId: string;
  status: string;
  round: number;
  nickname?: string;
  blackboardState: Blackboard;
  reportJson?: Record<string, unknown> | null;
  groupChatSummary?: Record<string, unknown> | null;
}

interface RunAssessmentTurnParams {
  session: RuntimeSession;
  scenario: RuntimeScenario;
  messages: Message[];
  userMessage: string;
}

interface RunAssessmentTurnResult {
  finished: boolean;
  reply: VisibleReply;
  round: number;
  phase: string;
  report?: unknown;
  blackboard: Blackboard;
  agent_trace?: AgentTraceEvent[];
}

type GraphEventType = "node" | "handoff" | "guardrail" | "tool" | "error";

interface TraceInput {
  nodeId: string;
  agentName: string;
  eventType: GraphEventType;
  status: GraphNodeStatus;
  summary: string;
  payload?: Record<string, unknown> | null;
  elapsedMs?: number | null;
}

// ── Helpers ────────────────────────────────────────────

function asAgentName(value: unknown): AgentName {
  return value === "coworker" || value === "client" || value === "leader" ? value : "leader";
}

function messageOrder(a: Message, b: Message): number {
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function shouldFinishByControl(blackboard: Blackboard): boolean {
  const reachedMinimumRounds = blackboard.round >= (blackboard.min_round ?? 8);
  const directorWantsFinish = Boolean(blackboard.conversation_control.should_finish);
  const maxReached = blackboard.round >= blackboard.max_round;
  const coverageStatus = summarizeCoverage(blackboard.coverage_state);

  return maxReached || (reachedMinimumRounds && directorWantsFinish && coverageStatus.complete);
}

function roleAgentCapabilityName(agent: AgentName): string {
  if (agent === "coworker") return "CoworkerRoleAgent";
  if (agent === "client") return "ClientRoleAgent";
  return "LeaderRoleAgent";
}

function sanitizeTracePayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 3) return "[truncated]";

  if (typeof value === "string") {
    return value.length > 280 ? `${value.slice(0, 277)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => sanitizeTracePayload(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/api[_-]?key|secret|token|prompt|rubric|answer|history|blackboard|full/i.test(key)) {
        sanitized[key] = "[redacted]";
      } else {
        sanitized[key] = sanitizeTracePayload(nested, depth + 1);
      }
    }
    return sanitized;
  }

  return String(value);
}

async function appendTraceEvent(
  state: InternalAssessmentGraphState,
  input: TraceInput,
  events?: Pick<StreamingTurnEvents, "onAgentTrace">
): Promise<Pick<InternalAssessmentGraphState, "traceEvents" | "traceSequence">> {
  const sequence = (state.traceSequence ?? 0) + 1;
  const payload = sanitizeTracePayload(input.payload ?? null) as Record<string, unknown> | null;

  try {
    const persisted = await prisma.agentTraceEvent.create({
      data: {
        sessionId: state.session.id,
        runId: state.runId,
        nodeId: input.nodeId,
        agentName: input.agentName,
        eventType: input.eventType,
        status: input.status,
        summary: input.summary,
        payloadJson: payload ? stringifyJson(payload) : null,
        elapsedMs: typeof input.elapsedMs === "number" ? Math.max(0, Math.round(input.elapsedMs)) : null,
        sequence
      }
    });
    const event = normalizeTraceEvent(persisted) as AgentTraceEvent;
    events?.onAgentTrace?.(event);
    return {
      traceEvents: [...(state.traceEvents ?? []), event],
      traceSequence: sequence
    };
  } catch (traceError) {
    log("warn", "Failed to persist AgentTraceEvent; continuing assessment turn", {
      traceError,
      runId: state.runId,
      nodeId: input.nodeId
    });
    return {
      traceEvents: state.traceEvents ?? [],
      traceSequence: sequence
    };
  }
}

async function withTrace(
  state: InternalAssessmentGraphState,
  events: Pick<StreamingTurnEvents, "onAgentTrace"> | undefined,
  input: Omit<TraceInput, "status" | "elapsedMs">,
  work: (stateWithStartTrace: InternalAssessmentGraphState) => Promise<Partial<InternalAssessmentGraphState>>,
  complete: (
    nextState: InternalAssessmentGraphState,
    update: Partial<InternalAssessmentGraphState>
  ) => Pick<TraceInput, "summary" | "payload" | "eventType"> | undefined
): Promise<Partial<InternalAssessmentGraphState>> {
  const startedAt = Date.now();
  const startedTrace = await appendTraceEvent(state, { ...input, status: "running" }, events);
  const stateWithStartTrace = { ...state, ...startedTrace };

  try {
    const update = await work(stateWithStartTrace);
    const nextState = { ...stateWithStartTrace, ...update };
    const completeInput = complete(nextState, update) ?? {
      summary: input.summary,
      payload: input.payload,
      eventType: input.eventType
    };
    const completedTrace = await appendTraceEvent(
      nextState,
      {
        nodeId: input.nodeId,
        agentName: input.agentName,
        eventType: completeInput.eventType ?? input.eventType,
        status: "completed",
        summary: completeInput.summary,
        payload: completeInput.payload,
        elapsedMs: Date.now() - startedAt
      },
      events
    );
    return { ...update, ...completedTrace };
  } catch (error) {
    await appendTraceEvent(
      stateWithStartTrace,
      {
        nodeId: input.nodeId,
        agentName: input.agentName,
        eventType: "error",
        status: "failed",
        summary: error instanceof Error ? error.message : "Node failed",
        payload: { errorType: error instanceof Error ? error.name : typeof error },
        elapsedMs: Date.now() - startedAt
      },
      events
    );
    throw error;
  }
}

// ── Agent selection ────────────────────────────────────

function diversifyAgentSelection(requestedAgent: AgentName, blackboard: Blackboard): AgentName {
  if (requestedAgent !== "leader") return requestedAgent;

  const lastAgent = blackboard.conversation_control.last_active_agent;
  const needsLeaderEscalation =
    blackboard.latest_user_behavior.over_promise || blackboard.latest_user_behavior.unsupported_assumption;

  if (blackboard.round < 1 || lastAgent !== "leader" || needsLeaderEscalation) {
    return requestedAgent;
  }

  return blackboard.user_progress.handled_coworker_conflict ? "client" : "coworker";
}

export function buildFallbackNpcInstruction(activeAgent: AgentName, blackboard: Blackboard): string {
  const profile = blackboard.scenario_facts.agent_profiles[activeAgent];
  const previousAgent = asAgentName(blackboard.conversation_control.last_active_agent);
  const previousProfile = blackboard.scenario_facts.agent_profiles[previousAgent];

  if (activeAgent === "leader") {
    return `由${profile.name}以${profile.role}身份追问用户的判断依据、承诺边界和下一步。不替用户做计划，也不提示标准答案。`;
  }

  return `避免继续由${previousProfile.name}追问。本轮让${profile.name}以${profile.role}身份从自身处境切入，追问用户如何处理边界、责任或预期。不替用户做计划，也不提示标准答案。`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function normalizeDirectorResult(
  result: Partial<DirectorResult> | undefined,
  blackboard: Blackboard
): DirectorResult {
  const activeAgent = asAgentName(result?.active_agent);
  const phase = isNonEmptyString(result?.phase) ? result.phase.trim() : blackboard.phase;
  const pressureLevel =
    typeof result?.pressure_level === "number" && Number.isFinite(result.pressure_level)
      ? result.pressure_level
      : blackboard.pressure_level;
  const currentFocus = isNonEmptyString(result?.current_focus)
    ? result.current_focus.trim()
    : blackboard.current_focus;
  const npcInstruction = isNonEmptyString(result?.npc_instruction)
    ? result.npc_instruction.trim()
    : buildFallbackNpcInstruction(activeAgent, blackboard);

  return {
    active_agent: activeAgent,
    phase,
    pressure_level: pressureLevel,
    current_focus: currentFocus,
    detected_behavior: asRecord(result?.detected_behavior) as Record<string, boolean> | undefined,
    dimension_evidence: Array.isArray(result?.dimension_evidence) ? result.dimension_evidence : [],
    npc_instruction: npcInstruction,
    trigger_group_discussion: Boolean(result?.trigger_group_discussion),
    should_finish: Boolean(result?.should_finish),
    finish_reason: isNonEmptyString(result?.finish_reason) ? result.finish_reason.trim() : "",
    updated_blackboard_patch: asRecord(result?.updated_blackboard_patch)
  };
}

export function resolveGroupDiscussionCorrection(result: GroupDiscussionResult): {
  changed: boolean;
  nextAgent?: AgentName;
  instruction?: string;
  blackboardPatch?: Record<string, unknown>;
} {
  if (result.no_change) return { changed: false };

  if (result.correction) {
    return {
      changed: true,
      nextAgent: result.correction.next_agent,
      instruction: result.correction.instruction,
      blackboardPatch: result.correction.blackboard_patch
    };
  }

  if (result.director_decision || result.blackboard_patch) {
    return {
      changed: true,
      nextAgent: result.director_decision?.next_agent,
      instruction: result.director_decision?.instruction,
      blackboardPatch: result.blackboard_patch
    };
  }

  return { changed: false };
}

async function callSelectedNpc(params: {
  activeAgent: AgentName;
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
  npcInstruction: string;
}): Promise<NpcResult> {
  if (params.activeAgent === "coworker") return callCoworkerAgent(params);
  if (params.activeAgent === "client") return callClientAgent(params);
  return callLeaderAgent(params);
}

// ── Pipeline stages ────────────────────────────────────

async function prepareTurn(
  session: RuntimeSession,
  messages: Message[],
  userMessage: string
) {
  const userRound = session.blackboardState.round;

  const savedUserMessage = await prisma.message.create({
    data: {
      sessionId: session.id,
      senderType: "user",
      senderName: session.nickname || "用户",
      senderRole: "受试者",
      content: userMessage,
      roundIndex: userRound
    }
  });

  const historyMessages = [...messages, savedUserMessage].sort(messageOrder);
  const historyText = formatHistory(historyMessages);

  return { userRound, savedUserMessage, historyMessages, historyText };
}

async function runDirectorChain(
  blackboard: Blackboard,
  historyText: string,
  userMessage: string,
  sessionId: string,
  turnId: string
) {
  const directorView = buildDirectorView(blackboard);
  const rawDirectorResult = await callDirectorAgent({
    blackboard: directorView,
    chatHistory: historyText,
    userMessage
  });
  const directorResult = normalizeDirectorResult(rawDirectorResult, blackboard);
  log("info", "Director Agent finished", {
    turnId,
    sessionId,
    activeAgent: directorResult.active_agent,
    phase: directorResult.phase,
    pressureLevel: directorResult.pressure_level,
    triggerGroupDiscussion: Boolean(directorResult.trigger_group_discussion),
    shouldFinish: Boolean(directorResult.should_finish)
  });

  blackboard = mergeBlackboard(blackboard, directorResult.updated_blackboard_patch);
  blackboard = applyDetectedBehavior(blackboard, directorResult.detected_behavior);
  const scenarioId = inferScenarioIdFromBlackboard(blackboard);
  const coverageAfterDimensionEvidence = updateCoverageFromDimensionEvidence(
    blackboard.coverage_state,
    scenarioId,
    directorResult.dimension_evidence,
    blackboard.round + 1
  );
  blackboard = mergeBlackboard(blackboard, {
    coverage_state: updateCoverageFromLegacyBehavior(
      coverageAfterDimensionEvidence,
      scenarioId,
      directorResult.detected_behavior,
      blackboard.round + 1,
      userMessage
    )
  });
  blackboard = mergeBlackboard(blackboard, {
    phase: directorResult.phase,
    pressure_level: directorResult.pressure_level,
    current_focus: directorResult.current_focus,
    conversation_control: {
      suggested_next_agent: directorResult.active_agent,
      trigger_group_discussion: Boolean(directorResult.trigger_group_discussion),
      should_finish: Boolean(directorResult.should_finish),
      finish_reason: directorResult.finish_reason ?? ""
    }
  });

  return { blackboard, directorResult };
}

async function runGroupDiscussionIfNeeded(
  blackboard: Blackboard,
  directorResult: Awaited<ReturnType<typeof runDirectorChain>>["directorResult"],
  scenario: RuntimeScenario,
  historyText: string,
  sessionId: string,
  turnId: string
) {
  const nextRound = blackboard.round + 1;
  const forcedGroupDiscussion = shouldForceGroupDiscussion(blackboard);
  const shouldRun =
    scenario.groupChatEnabled && (Boolean(directorResult.trigger_group_discussion) || forcedGroupDiscussion);

  let activeAgent = asAgentName(directorResult.active_agent);
  let npcInstruction = directorResult.npc_instruction;

  if (!shouldRun) {
    return { blackboard, activeAgent, npcInstruction, groupResult: null };
  }

  log("info", "Calling Group Discussion Agent", {
    turnId, sessionId, round: nextRound,
    directorTriggered: Boolean(directorResult.trigger_group_discussion),
    forcedGroupDiscussion
  });

  const directorProposal = {
    active_agent: directorResult.active_agent,
    current_focus: directorResult.current_focus,
    npc_instruction: directorResult.npc_instruction,
    phase: directorResult.phase
  };
  const groupView = buildGroupDiscussionView(blackboard);

  const groupResult = await callGroupDiscussionAgent({
    blackboard: groupView,
    chatHistory: historyText,
    round: nextRound,
    directorProposal
  });

  const groupCorrection = resolveGroupDiscussionCorrection(groupResult);
  log("info", "Group Discussion Agent finished", {
    turnId, sessionId,
    noChange: Boolean(groupResult.no_change),
    changed: groupCorrection.changed,
    nextAgent: groupCorrection.nextAgent
  });

  try {
    await prisma.agentGroupDiscussion.create({
      data: {
        sessionId,
        roundIndex: nextRound,
        phase: directorResult.phase || "group_check",
        inputJson: stringifyJson({ blackboard: groupView, history: historyText, directorProposal }),
        outputJson: stringifyJson(groupResult)
      }
    });
  } catch (gdError) {
    log("warn", "Failed to persist Group Discussion record; continuing without it", { gdError });
  }

  blackboard = addGroupSummary(blackboard, nextRound, groupResult as Record<string, unknown>);

  if (groupCorrection.changed) {
    blackboard = mergeBlackboard(blackboard, groupCorrection.blackboardPatch);
    activeAgent = asAgentName(groupCorrection.nextAgent ?? activeAgent);
    npcInstruction = groupCorrection.instruction ?? npcInstruction;
    blackboard = mergeBlackboard(blackboard, {
      conversation_control: {
        suggested_next_agent: activeAgent,
        trigger_group_discussion: true
      }
    });
  }

  return { blackboard, activeAgent, npcInstruction, groupResult };
}

async function runNpcTurn(
  blackboard: Blackboard,
  activeAgent: AgentName,
  npcInstruction: string,
  historyText: string,
  userMessage: string,
  sessionId: string,
  turnId: string
) {
  // Diversify agent selection
  const requestedAgent = activeAgent;
  activeAgent = diversifyAgentSelection(activeAgent, blackboard);
  if (activeAgent !== requestedAgent) {
    npcInstruction = buildFallbackNpcInstruction(activeAgent, blackboard);
    log("info", "Adjusted NPC agent to avoid leader overuse", {
      turnId, sessionId, requestedAgent, adjustedAgent: activeAgent,
      lastActiveAgent: blackboard.conversation_control.last_active_agent
    });
  }

  blackboard = mergeBlackboard(blackboard, {
    conversation_control: {
      last_active_agent: activeAgent,
      suggested_next_agent: activeAgent
    }
  });

  log("info", "Calling NPC Agent", { turnId, sessionId, activeAgent });
  const npcView = buildNpcView(blackboard, activeAgent, npcInstruction);

  const npcResult = await callSelectedNpc({
    activeAgent, blackboard: npcView, chatHistory: historyText, userMessage, npcInstruction
  });

  if (!npcResult.visible_reply?.content) {
    throw new Error("NPC Agent response is missing visible_reply.content");
  }

  log("info", "NPC Agent finished", {
    turnId, sessionId,
    speaker: npcResult.visible_reply.speaker,
    replyChars: npcResult.visible_reply.content.length
  });

  return { blackboard, activeAgent, npcResult };
}

async function runNpcTurnStreaming(
  blackboard: Blackboard,
  activeAgent: AgentName,
  npcInstruction: string,
  historyText: string,
  userMessage: string,
  sessionId: string,
  turnId: string,
  events: Pick<StreamingTurnEvents, "onSpeaker" | "onToken" | "onError">
) {
  const requestedAgent = activeAgent;
  activeAgent = diversifyAgentSelection(activeAgent, blackboard);
  if (activeAgent !== requestedAgent) {
    npcInstruction = buildFallbackNpcInstruction(activeAgent, blackboard);
    log("info", "Adjusted NPC agent to avoid leader overuse", {
      turnId, sessionId, requestedAgent, adjustedAgent: activeAgent,
      lastActiveAgent: blackboard.conversation_control.last_active_agent
    });
  }

  blackboard = mergeBlackboard(blackboard, {
    conversation_control: {
      last_active_agent: activeAgent,
      suggested_next_agent: activeAgent
    }
  });

  log("info", "Calling NPC Agent (streaming)", { turnId, sessionId, activeAgent });
  const activeProfile = blackboard.scenario_facts.agent_profiles[activeAgent];
  events.onSpeaker(activeProfile.name, activeProfile.role);
  const npcView = buildNpcView(blackboard, activeAgent, npcInstruction);

  const npcResult = await callNpcAgentStreaming({
    agent: activeAgent,
    blackboard: npcView,
    chatHistory: historyText,
    userMessage,
    npcInstruction,
    onToken: events.onToken
  });

  if (!npcResult.visible_reply?.content) {
    events.onError("NPC Agent response is missing visible_reply.content");
    throw new Error("NPC Agent response is missing visible_reply.content");
  }

  log("info", "NPC Agent finished (streaming)", {
    turnId, sessionId,
    speaker: npcResult.visible_reply.speaker,
    replyChars: npcResult.visible_reply.content.length
  });

  return { blackboard, activeAgent, npcResult };
}

async function persistTurn(
  sessionId: string,
  blackboard: Blackboard,
  npcResult: NpcResult,
  historyMessages: Message[],
  nextRound: number
) {
  const savedNpcMessage = await prisma.message.create({
    data: {
      sessionId,
      senderType: "agent",
      senderName: npcResult.visible_reply.speaker,
      senderRole: npcResult.visible_reply.role,
      content: npcResult.visible_reply.content,
      roundIndex: nextRound
    }
  });

  blackboard = mergeNpcMemory(blackboard, npcResult.memory_update);
  blackboard.round = nextRound;

  const fullHistory = formatHistory([...historyMessages, savedNpcMessage].sort(messageOrder));

  return { blackboard, fullHistory };
}

async function finishWithJudge(
  blackboard: Blackboard,
  fullHistory: string,
  session: RuntimeSession,
  directorPhase: string,
  npcReply: VisibleReply,
  turnId: string,
  onReportProgress?: (progress: JudgeProgressEvent) => void
): Promise<RunAssessmentTurnResult> {
  const reportStartedAt = Date.now();
  const emitReportProgress = (progress: Omit<JudgeProgressEvent, "elapsedMs"> & { elapsedMs?: number }) => {
    onReportProgress?.({
      ...progress,
      elapsedMs: progress.elapsedMs ?? Date.now() - reportStartedAt
    });
  };

  emitReportProgress({
    stage: "preparing",
    percent: 5,
    message: "正在整理对话记录、行为证据和 Judge view。"
  });

  log("info", "Calling Judge Agent", {
    turnId, sessionId: session.id,
    historyChars: fullHistory.length,
    finishReason: blackboard.round >= blackboard.max_round
      ? "max_round_reached"
      : blackboard.conversation_control.finish_reason
  });

  const { report, samplingStats } = await callJudgeAgent({
    blackboard: buildJudgeView(blackboard),
    chatHistory: fullHistory,
    groupSummary: blackboard.group_discussion_summary
  }, emitReportProgress);

  log("info", "Judge Agent finished", {
    turnId, sessionId: session.id,
    totalScore: report.total_score,
    samplingVariance: samplingStats.variance,
    samplingScores: samplingStats.scores
  });

  const coverageStatus = summarizeCoverage(blackboard.coverage_state);
  const judgedReport =
    report.report_status === "confident" && !coverageStatus.complete
      ? {
          ...report,
          report_status: "provisional" as const,
          human_review_required: true,
          human_review_reason: report.human_review_reason
            ? `${report.human_review_reason}；测评槽位覆盖不足，报告仅作观察反馈。`
            : "测评槽位覆盖不足，报告仅作观察反馈。"
        }
      : report;

  const reportWithMeta = {
    ...judgedReport,
    coverage_status: coverageStatus,
    sampling_stats: {
      scores: samplingStats.scores,
      variance: Math.round(samplingStats.variance * 100) / 100,
      dim_variances: samplingStats.dimVariances
    }
  };
  const formalTotalScore =
    reportWithMeta.mock_generated || reportWithMeta.report_status !== "confident"
      ? null
      : Math.round(reportWithMeta.total_score);

  emitReportProgress({
    stage: "saving",
    percent: 94,
    message: "正在保存报告并准备跳转。"
  });

  await prisma.assessmentSession.update({
    where: { id: session.id },
    data: {
      status: "finished",
      round: blackboard.round,
      blackboardState: stringifyJson(blackboard),
      groupChatSummary: stringifyJson(blackboard.group_discussion_summary),
      totalScore: formalTotalScore,
      reportJson: stringifyJson(reportWithMeta),
      endedAt: new Date()
    }
  });

  emitReportProgress({
    stage: "done",
    percent: 100,
    message: "行为观察报告已生成。"
  });

  return {
    finished: true,
    reply: npcReply,
    round: blackboard.round,
    phase: directorPhase,
    report: reportWithMeta,
    blackboard
  };
}

function createUnratableReport(blackboard: Blackboard, gate: ResponseQualityGate): JudgeReport {
  const dimensions = blackboard.scenario_facts.capability_dimensions;
  const dimensionScores = Object.fromEntries(dimensions.map((dimension) => [dimension, 0]));
  const dimensionAnalysis = Object.fromEntries(
    dimensions.map((dimension) => [
      dimension,
      "单轮答题计时结束，本次测评未采集到可评分的维度证据。"
    ])
  );
  const coverageStatus = summarizeCoverage(blackboard.coverage_state);
  const quotedTurns = gate.lowInformationTurns
    .map((turn) => (turn.reason === "time_expired" ? "系统计时结束" : turn.content.trim()))
    .filter(Boolean);
  const humanReviewReason = "单轮答题计时结束，系统自动结束本次测评。";

  return {
    total_score: 0,
    level: "无法评分",
    dimension_scores: dimensionScores,
    dimension_analysis: dimensionAnalysis,
    conflict_style: "无法判断",
    summary: "本次测评因单轮答题计时结束而收束。系统没有调用 Judge 生成正式分数。",
    strengths: [],
    risks: ["本轮未采集到足够的可观察行为证据，无法判断管理情境下的真实能力表现。"],
    suggestions: ["重新测评时，请在单轮计时内用完整句说明你的判断依据、取舍、边界和下一步动作。"],
    evidence: quotedTurns.length
      ? quotedTurns.map((quote) => ({
          dimension: "作答有效性",
          quote,
          analysis: "该轮未形成可评分的作答证据。"
        }))
      : [{
          dimension: "作答有效性",
          quote: "系统计时结束",
          analysis: "该轮未形成可评分的作答证据。"
        }],
    radar_chart_data: dimensions.map((dimension) => ({ name: dimension, score: 0, max: 20 })),
    final_recommendation: "建议重新开始一次有效作答。本次结果不能用于正式评价或比较。",
    human_review_required: true,
    human_review_reason: humanReviewReason,
    mock_generated: false,
    report_status: "unratable",
    coverage_status: coverageStatus
  };
}

async function finishAsUnratable(
  blackboard: Blackboard,
  session: RuntimeSession,
  gate: ResponseQualityGate,
  turnId: string
): Promise<RunAssessmentTurnResult> {
  const reply: VisibleReply = {
    speaker: "系统",
    role: "测评控制",
    content: "本轮计时已结束，系统已自动结束本次测评。本次不会生成正式分数。"
  };
  const endedRound = blackboard.round + 1;
  const finishedBlackboard = mergeBlackboard(blackboard, {
    conversation_control: {
      should_finish: true,
      finish_reason: gate.reason
    }
  });
  finishedBlackboard.round = endedRound;
  const report = createUnratableReport(finishedBlackboard, gate);

  await prisma.message.create({
    data: {
      sessionId: session.id,
      senderType: "agent",
      senderName: reply.speaker,
      senderRole: reply.role,
      content: reply.content,
      roundIndex: endedRound
    }
  });

  await prisma.assessmentSession.update({
    where: { id: session.id },
    data: {
      status: "finished",
      round: endedRound,
      blackboardState: stringifyJson(finishedBlackboard),
      groupChatSummary: stringifyJson(finishedBlackboard.group_discussion_summary),
      totalScore: null,
      reportJson: stringifyJson(report),
      endedAt: new Date()
    }
  });

  log("info", "Assessment finished as unratable", {
    turnId,
    sessionId: session.id,
    reason: gate.reason,
    consecutiveLowInformation: gate.consecutiveLowInformation
  });

  return {
    finished: true,
    reply,
    round: endedRound,
    phase: finishedBlackboard.phase,
    report,
    blackboard: finishedBlackboard
  };
}

// ── LangGraph assessment graph ─────────────────────────

function buildSafeGraphResult(state: InternalAssessmentGraphState): RunAssessmentTurnResult {
  if (!state.result) {
    throw new Error("AssessmentGraph finalized without a result");
  }

  return {
    ...state.result,
    agent_trace: state.traceEvents ?? []
  };
}

async function executeAssessmentGraph(
  params: RunAssessmentTurnParams,
  options: { events?: StreamingTurnEvents; turnId: string; startedAt: number }
): Promise<RunAssessmentTurnResult> {
  const { session, scenario, messages, userMessage } = params;
  const { events, turnId, startedAt } = options;

  const prepareTurnNode = async (state: InternalAssessmentGraphState) =>
    withTrace(
      state,
      events,
      {
        nodeId: "prepareTurn",
        agentName: "AssessmentGraph",
        eventType: "tool",
        summary: "Persisting user reply and preparing chat history.",
        payload: { round: state.session.round, messageChars: state.userMessage.length }
      },
      async () => {
        const { historyText, historyMessages } = await prepareTurn(state.session, state.messages, state.userMessage);
        return { historyText, historyMessages };
      },
      (nextState) => ({
        summary: "User reply persisted; safe chat history prepared.",
        eventType: "tool",
        payload: {
          round: nextState.session.round,
          historyMessages: nextState.historyMessages?.length ?? 0,
          historyChars: nextState.historyText?.length ?? 0
        }
      })
    );

  const responseQualityGateNode = async (state: InternalAssessmentGraphState) =>
    withTrace(
      state,
      events,
      {
        nodeId: "responseQualityGate",
        agentName: "ResponseQualityGate",
        eventType: "guardrail",
        summary: "Checking whether the user reply contains scoreable behavior evidence.",
        payload: { deterministicTool: "response_quality_gate" }
      },
      async () => {
        const responseQuality = evaluateResponseQuality(state.messages, state.userMessage);
        return {
          responseQuality,
          shouldTerminateAsUnratable: responseQuality.shouldTerminate
        };
      },
      (nextState) => ({
        summary: nextState.responseQuality?.shouldTerminate
          ? "Low-information guardrail will end the run without Judge scoring."
          : "Reply passed quality gate; handoff to Director.",
        eventType: "guardrail",
        payload: {
          shouldTerminate: Boolean(nextState.responseQuality?.shouldTerminate),
          reason: nextState.responseQuality?.reason,
          consecutiveLowInformation: nextState.responseQuality?.consecutiveLowInformation
        }
      })
    );

  const directorNode = async (state: InternalAssessmentGraphState) =>
    withTrace(
      state,
      events,
      {
        nodeId: "director",
        agentName: "Director",
        eventType: "node",
        summary: "Director is selecting the next observation focus and role handoff.",
        payload: {
          capabilityCard: getAssessmentAgentCapabilityCards().find((card) => card.name === "Director"),
          deterministicTools: ["coverage_tracker", "rubric_reader"]
        }
      },
      async () => {
        if (!state.historyText) throw new Error("Director node requires prepared history");
        log("info", "Calling Director Agent", {
          turnId: state.turnId,
          sessionId: state.session.id,
          historyChars: state.historyText.length
        });
        const { blackboard, directorResult } = await runDirectorChain(
          state.blackboard,
          state.historyText,
          state.userMessage,
          state.session.id,
          state.turnId
        );
        return {
          blackboard,
          directorResult,
          activeAgent: asAgentName(directorResult.active_agent),
          npcInstruction: directorResult.npc_instruction,
          phase: directorResult.phase
        };
      },
      (nextState) => ({
        summary: `Director handed off to ${roleAgentCapabilityName(asAgentName(nextState.directorResult?.active_agent))}.`,
        eventType: "handoff",
        payload: {
          handoff: {
            from: "Director",
            to: roleAgentCapabilityName(asAgentName(nextState.directorResult?.active_agent)),
            reason: nextState.directorResult?.current_focus ?? "next_observation_focus"
          },
          phase: nextState.directorResult?.phase,
          pressureLevel: nextState.directorResult?.pressure_level,
          triggerGroupDiscussion: Boolean(nextState.directorResult?.trigger_group_discussion),
          shouldFinish: Boolean(nextState.directorResult?.should_finish),
          coverage: summarizeCoverage(nextState.blackboard.coverage_state)
        }
      })
    );

  const groupGuardNode = async (state: InternalAssessmentGraphState) => {
    if (!state.directorResult || !state.historyText) {
      throw new Error("GroupGuard node requires Director result and history");
    }

    const forcedGroupDiscussion = shouldForceGroupDiscussion(state.blackboard);
    const shouldRun =
      state.scenario.groupChatEnabled &&
      (Boolean(state.directorResult.trigger_group_discussion) || forcedGroupDiscussion);

    if (!shouldRun) {
      const skippedTrace = await appendTraceEvent(
        state,
        {
          nodeId: "groupGuard",
          agentName: "GroupGuard",
          eventType: "guardrail",
          status: "skipped",
          summary: "GroupGuard skipped; Director proposal did not require internal correction.",
          payload: {
            groupChatEnabled: state.scenario.groupChatEnabled,
            directorTriggered: Boolean(state.directorResult.trigger_group_discussion),
            forcedGroupDiscussion
          }
        },
        events
      );
      return {
        ...skippedTrace,
        activeAgent: asAgentName(state.directorResult.active_agent),
        npcInstruction: state.directorResult.npc_instruction,
        groupResult: null
      };
    }

    return withTrace(
      state,
      events,
      {
        nodeId: "groupGuard",
        agentName: "GroupGuard",
        eventType: "guardrail",
        summary: "GroupGuard is validating Director handoff and memory consistency.",
        payload: {
          capabilityCard: getAssessmentAgentCapabilityCards().find((card) => card.name === "GroupGuard"),
          directorTriggered: Boolean(state.directorResult.trigger_group_discussion),
          forcedGroupDiscussion
        }
      },
      async () => {
        const result = await runGroupDiscussionIfNeeded(
          state.blackboard,
          state.directorResult!,
          state.scenario,
          state.historyText!,
          state.session.id,
          state.turnId
        );
        return {
          blackboard: result.blackboard,
          activeAgent: result.activeAgent,
          npcInstruction: result.npcInstruction,
          groupResult: result.groupResult
        };
      },
      (nextState) => ({
        summary: nextState.groupResult?.no_change
          ? "GroupGuard accepted Director handoff."
          : "GroupGuard applied or recorded a protective correction.",
        eventType: "guardrail",
        payload: {
          noChange: Boolean(nextState.groupResult?.no_change),
          conflicts: nextState.groupResult?.conflicts?.map((item) => ({
            type: item.type,
            severity: item.severity
          })),
          handoff: {
            from: "GroupGuard",
            to: roleAgentCapabilityName(asAgentName(nextState.activeAgent)),
            reason: nextState.groupResult?.correction?.next_focus ?? "validated_role_handoff"
          }
        }
      })
    );
  };

  const npcNode = async (state: InternalAssessmentGraphState) =>
    withTrace(
      state,
      events,
      {
        nodeId: "npc",
        agentName: roleAgentCapabilityName(asAgentName(state.activeAgent)),
        eventType: "node",
        summary: "Role Agent is producing the next visible workplace prompt.",
        payload: {
          capabilityCard: getAssessmentAgentCapabilityCards().find(
            (card) => card.name === roleAgentCapabilityName(asAgentName(state.activeAgent))
          ),
          deterministicTools: ["boundary_guard", "memory_merge"],
          rubricVisible: false
        }
      },
      async () => {
        const activeAgent = asAgentName(state.activeAgent ?? state.directorResult?.active_agent);
        const historyText = state.historyText ?? (state.historyMessages ? formatHistory(state.historyMessages) : undefined);
        const npcInstruction = isNonEmptyString(state.npcInstruction)
          ? state.npcInstruction.trim()
          : isNonEmptyString(state.directorResult?.npc_instruction)
            ? state.directorResult.npc_instruction.trim()
            : buildFallbackNpcInstruction(activeAgent, state.blackboard);

        if (!historyText) {
          throw new Error("NPC node requires prepared history");
        }
        const result = events
          ? await runNpcTurnStreaming(
              state.blackboard,
              activeAgent,
              npcInstruction,
              historyText,
              state.userMessage,
              state.session.id,
              state.turnId,
              events
            )
          : await runNpcTurn(
              state.blackboard,
              activeAgent,
              npcInstruction,
              historyText,
              state.userMessage,
              state.session.id,
              state.turnId
            );
        return {
          blackboard: result.blackboard,
          activeAgent: result.activeAgent,
          npcInstruction,
          npcResult: result.npcResult,
          reply: result.npcResult.visible_reply,
          phase: state.directorResult?.phase ?? state.phase
        };
      },
      (nextState) => ({
        summary: `${nextState.npcResult?.visible_reply.speaker ?? "Role Agent"} sent a boundary-checked visible reply.`,
        eventType: "node",
        payload: {
          activeAgent: nextState.activeAgent,
          speaker: nextState.npcResult?.visible_reply.speaker,
          replyChars: nextState.npcResult?.visible_reply.content.length ?? 0,
          rubricVisible: false
        }
      })
    );

  const persistTurnNode = async (state: InternalAssessmentGraphState) =>
    withTrace(
      state,
      events,
      {
        nodeId: "persistTurn",
        agentName: "MemoryMergeTool",
        eventType: "tool",
        summary: "Persisting role reply and merging NPC memory into blackboard.",
        payload: { deterministicTool: "memory_merge" }
      },
      async () => {
        if (!state.npcResult || !state.historyMessages) {
          throw new Error("Persist node requires NPC result and prepared messages");
        }
        const nextRound = state.blackboard.round + 1;
        const { blackboard, fullHistory } = await persistTurn(
          state.session.id,
          state.blackboard,
          state.npcResult,
          state.historyMessages,
          nextRound
        );
        return {
          blackboard,
          fullHistory,
          round: blackboard.round,
          reply: state.npcResult.visible_reply
        };
      },
      (nextState) => ({
        summary: "Turn persisted and blackboard advanced.",
        eventType: "tool",
        payload: {
          round: nextState.blackboard.round,
          memoryMerged: true,
          fullHistoryChars: nextState.fullHistory?.length ?? 0
        }
      })
    );

  const finishDecisionNode = async (state: InternalAssessmentGraphState) =>
    withTrace(
      state,
      events,
      {
        nodeId: "finishDecision",
        agentName: "FinishDecisionGate",
        eventType: "guardrail",
        summary: "Checking coverage, Director finish signal, and max round limit.",
        payload: { deterministicTool: "coverage_tracker" }
      },
      async () => {
        const shouldRunJudge = shouldFinishByControl(state.blackboard);
        return {
          shouldRunJudge,
          finished: shouldRunJudge
        };
      },
      (nextState) => ({
        summary: nextState.shouldRunJudge
          ? "Finish gate routed the graph to Judge."
          : "Finish gate routed the graph to finalize without scoring.",
        eventType: "guardrail",
        payload: {
          shouldRunJudge: Boolean(nextState.shouldRunJudge),
          round: nextState.blackboard.round,
          maxRound: nextState.blackboard.max_round,
          directorWantsFinish: Boolean(nextState.blackboard.conversation_control.should_finish),
          coverage: summarizeCoverage(nextState.blackboard.coverage_state)
        }
      })
    );

  const judgeNode = async (state: InternalAssessmentGraphState) =>
    withTrace(
      state,
      events,
      {
        nodeId: "judge",
        agentName: "Judge",
        eventType: "node",
        summary: "Judge is sampling and building the final observation report.",
        payload: {
          capabilityCard: getAssessmentAgentCapabilityCards().find((card) => card.name === "Judge"),
          deterministicTools: ["rubric_reader", "report_reliability_gate"]
        }
      },
      async () => {
        if (!state.fullHistory || !state.reply) {
          throw new Error("Judge node requires full history and visible reply");
        }
        events?.onJudging?.();
        const result = await finishWithJudge(
          state.blackboard,
          state.fullHistory,
          state.session,
          state.directorResult?.phase ?? state.phase ?? "judge",
          state.reply,
          state.turnId,
          events?.onReportProgress
        );
        return {
          finished: true,
          reply: result.reply,
          round: result.round,
          phase: result.phase,
          report: result.report,
          blackboard: result.blackboard
        };
      },
      (nextState) => {
        const report = nextState.report as { report_status?: string; total_score?: number; mock_generated?: boolean } | undefined;
        return {
          summary: "Judge completed sampling and report reliability gate.",
          eventType: "node",
          payload: {
            reportStatus: report?.report_status,
            mockGenerated: Boolean(report?.mock_generated),
            totalScore: report?.total_score,
            coverage: summarizeCoverage(nextState.blackboard.coverage_state)
          }
        };
      }
    );

  const unratableNode = async (state: InternalAssessmentGraphState) =>
    withTrace(
      state,
      events,
      {
        nodeId: "unratable",
        agentName: "ResponseQualityGate",
        eventType: "guardrail",
        summary: "Ending the run as unratable without invoking Judge.",
        payload: { reason: state.responseQuality?.reason }
      },
      async () => {
        if (!state.responseQuality) {
          throw new Error("Unratable node requires response quality result");
        }
        const result = await finishAsUnratable(state.blackboard, state.session, state.responseQuality, state.turnId);
        events?.onSpeaker(result.reply.speaker, result.reply.role);
        if (events) {
          emitVisibleReplyChunks(result.reply.content, events.onToken);
        }
        return {
          finished: true,
          reply: result.reply,
          round: result.round,
          phase: result.phase,
          report: result.report,
          blackboard: result.blackboard
        };
      },
      (nextState) => ({
        summary: "Unratable report persisted; Judge was skipped.",
        eventType: "guardrail",
        payload: {
          reportStatus: (nextState.report as { report_status?: string } | undefined)?.report_status,
          round: nextState.round,
          judgeInvoked: false
        }
      })
    );

  const finalizeNode = async (state: InternalAssessmentGraphState) =>
    withTrace(
      state,
      events,
      {
        nodeId: "finalize",
        agentName: "AssessmentGraph",
        eventType: "tool",
        summary: "Finalizing graph output and session state.",
        payload: { deterministicTool: "finalize_result" }
      },
      async () => {
        if (!state.reply) {
          throw new Error("Finalize node requires a visible reply");
        }

        if (!state.finished) {
          await prisma.assessmentSession.update({
            where: { id: state.session.id },
            data: {
              round: state.blackboard.round,
              blackboardState: stringifyJson(state.blackboard),
              groupChatSummary: stringifyJson(state.blackboard.group_discussion_summary)
            }
          });
        }

        const result: RunAssessmentTurnResult = {
          finished: Boolean(state.finished),
          reply: state.reply,
          round: state.round ?? state.blackboard.round,
          phase: state.phase ?? state.directorResult?.phase ?? state.blackboard.phase,
          report: state.report,
          blackboard: state.blackboard
        };

        log(events ? "info" : "info", events ? "Assessment turn finished (streaming)" : "Assessment turn finished", {
          turnId: state.turnId,
          sessionId: state.session.id,
          round: result.round,
          finished: result.finished,
          durationMs: Date.now() - state.startedAt
        });

        return { result };
      },
      (nextState) => ({
        summary: nextState.result?.finished
          ? "AssessmentGraph finalized a finished session."
          : "AssessmentGraph finalized this turn and kept the session running.",
        eventType: "tool",
        payload: {
          finished: Boolean(nextState.result?.finished),
          round: nextState.result?.round,
          traceEvents: (nextState.traceEvents?.length ?? 0) + 1
        }
      })
    );

  const graph = new StateGraph(AssessmentGraphAnnotation)
    .addNode("prepareTurn", prepareTurnNode)
    .addNode("responseQualityGate", responseQualityGateNode)
    .addNode("director", directorNode)
    .addNode("groupGuard", groupGuardNode)
    .addNode("npc", npcNode)
    .addNode("persistTurn", persistTurnNode)
    .addNode("finishDecision", finishDecisionNode)
    .addNode("judge", judgeNode)
    .addNode("unratable", unratableNode)
    .addNode("finalize", finalizeNode)
    .addEdge(START, "prepareTurn")
    .addEdge("prepareTurn", "responseQualityGate")
    .addConditionalEdges(
      "responseQualityGate",
      (state) => (state.shouldTerminateAsUnratable ? "unratable" : "director"),
      {
        unratable: "unratable",
        director: "director"
      }
    )
    .addEdge("director", "groupGuard")
    .addEdge("groupGuard", "npc")
    .addEdge("npc", "persistTurn")
    .addEdge("persistTurn", "finishDecision")
    .addConditionalEdges(
      "finishDecision",
      (state) => (state.shouldRunJudge ? "judge" : "finalize"),
      {
        judge: "judge",
        finalize: "finalize"
      }
    )
    .addEdge("judge", "finalize")
    .addEdge("unratable", "finalize")
    .addEdge("finalize", END)
    .compile({
      name: "AssessmentGraph",
      description: "Controlled LangGraph orchestration for workplace assessment turns."
    });

  const finalState = await graph.invoke({
    runId: turnId,
    turnId,
    startedAt,
    session,
    scenario,
    messages,
    userMessage,
    blackboard: session.blackboardState,
    traceEvents: [],
    traceSequence: 0
  });

  return buildSafeGraphResult(finalState);
}

// ── Main orchestrator ──────────────────────────────────

export async function runAssessmentTurn({
  session,
  scenario,
  messages,
  userMessage
}: RunAssessmentTurnParams): Promise<RunAssessmentTurnResult> {
  const turnId = createRequestId("turn");
  const startedAt = Date.now();

  log("info", "Assessment turn started", {
    turnId, sessionId: session.id, round: session.blackboardState.round, userMessageChars: userMessage.length
  });

  if (session.status !== "running") {
    throw new Error("This assessment session has already finished");
  }

  return executeAssessmentGraph(
    { session, scenario, messages, userMessage },
    { turnId, startedAt }
  );
}

// ── Streaming orchestrator ─────────────────────────────

export interface StreamingTurnEvents {
  onSpeaker: (speaker: string, role: string) => void;
  onToken: (token: string) => void;
  onAgentTrace?: (event: AgentTraceEvent) => void;
  onJudging?: () => void;
  onReportProgress?: (progress: JudgeProgressEvent) => void;
  onDone: (result: RunAssessmentTurnResult) => void;
  onError: (message: string) => void;
}

export async function runAssessmentTurnStreaming({
  session,
  scenario,
  messages,
  userMessage,
  events
}: RunAssessmentTurnParams & { events: StreamingTurnEvents }): Promise<void> {
  const turnId = createRequestId("turn");
  const startedAt = Date.now();

  log("info", "Assessment turn started (streaming)", {
    turnId, sessionId: session.id, round: session.blackboardState.round, userMessageChars: userMessage.length
  });

  try {
    if (session.status !== "running") {
      events.onError("This assessment session has already finished");
      return;
    }

    const result = await executeAssessmentGraph(
      { session, scenario, messages, userMessage },
      { events, turnId, startedAt }
    );
    events.onDone(result);
  } catch (error) {
    log("error", "Assessment turn streaming failed", { turnId, error });
    events.onError(error instanceof Error ? error.message : "Internal error");
  }
}
