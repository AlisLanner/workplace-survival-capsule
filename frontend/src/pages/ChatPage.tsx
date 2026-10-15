import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getSession, normalizeReport, sendMessageStream } from "../api/assessment.api";
import { ChatBubble } from "../components/ChatBubble";
import { MessageInput } from "../components/MessageInput";
import { getScenarioPresentation } from "../config/scenarioPresentation";
import type { AgentTraceEvent, Message, ReportProgressEvent, Scenario, SessionDetail } from "../types/assessment";

const typingMessageId = "agent-typing";
const reportGeneratingMessageId = "report-generating";
const NICKNAME_KEY = "maat_nickname";
const AUTO_TIMEOUT_MESSAGE = "__ASSESSMENT_TIME_EXPIRED__";
const LEGACY_TIMEOUT_MESSAGES = new Set([AUTO_TIMEOUT_MESSAGE, "（时间到）", "(时间到)", "时间到"]);
const TURN_TIME_LIMIT = 240;
const WARNING_THRESHOLD = 25;
const REPORT_PROGRESS_STALE_MS = 12000;
const STREAM_FLUSH_INTERVAL_MS = 50;
const DEFAULT_MAX_ROUND = 15;

type TimedReportProgress = ReportProgressEvent & {
  startedAt: number;
  receivedAt: number;
};

const runStripNodes = [
  { id: "director", label: "Director", fallback: "等待调度" },
  { id: "groupGuard", label: "GroupGuard", fallback: "等待校验" },
  { id: "npc", label: "Role Agent", fallback: "等待追问" },
  { id: "finishDecision", label: "Finish Gate", fallback: "等待覆盖检查" },
  { id: "judge", label: "Judge", fallback: "按需采样" }
];

function clampProgressPercent(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 5;
  return Math.max(5, Math.min(100, Math.round(value)));
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function sampleProgressText(progress: TimedReportProgress | null): string {
  if (!progress || progress.stage !== "judge_sampling" || !progress.total) {
    return "阶段进度会在后端完成对应步骤后更新";
  }
  return `Judge 采样 ${progress.current ?? 0}/${progress.total}`;
}

function isVisibleChatMessage(message: Message): boolean {
  return !(message.senderType === "user" && LEGACY_TIMEOUT_MESSAGES.has(message.content.trim()));
}

function mergeTraceEvents(current: AgentTraceEvent[], incoming: AgentTraceEvent[]): AgentTraceEvent[] {
  const byKey = new Map<string, AgentTraceEvent>();
  for (const event of current) {
    byKey.set(event.id || `${event.runId}:${event.sequence}:${event.nodeId}:${event.status}`, event);
  }
  for (const event of incoming) {
    byKey.set(event.id || `${event.runId}:${event.sequence}:${event.nodeId}:${event.status}`, event);
  }
  return [...byKey.values()].sort((a, b) => a.sequence - b.sequence || a.createdAt.localeCompare(b.createdAt));
}

function latestTraceForNode(trace: AgentTraceEvent[], nodeId: string): AgentTraceEvent | undefined {
  return trace.filter((event) => event.nodeId === nodeId).at(-1);
}

function traceStatusLabel(event: AgentTraceEvent | undefined, fallback: string): string {
  if (!event) return fallback;
  if (event.status === "running") return "运行中";
  if (event.status === "completed") return event.elapsedMs ? `${event.elapsedMs}ms` : "已完成";
  if (event.status === "skipped") return "已跳过";
  if (event.status === "failed") return "失败";
  return event.status;
}

function AgentRunStrip({ trace, active }: { trace: AgentTraceEvent[]; active: boolean }) {
  return (
    <div className="stages" aria-label="Agent 协作进度">
      {runStripNodes.map((node) => {
        const latest = latestTraceForNode(trace, node.id);
        const status = latest?.status ?? "pending";
        const statusClass = status === "completed" ? "done" : status === "running" ? "active" : "";
        const statusText = status === "running" && node.id === "npc" ? "追问中" : traceStatusLabel(latest, node.fallback);
        return (
          <div className={`stage${statusClass ? ` ${statusClass}` : ""}`} key={node.id}>
            <span className="nm">
              <span className="sdot" />
              {node.label}
            </span>
            <span className="st">{statusText}</span>
          </div>
        );
      })}
    </div>
  );
}

function getStoredNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? "用户";
  } catch {
    return "用户";
  }
}

export function ChatPage() {
  const userNickname = getStoredNickname();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [agentTrace, setAgentTrace] = useState<AgentTraceEvent[]>([]);
  const [sending, setSending] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportProgress, setReportProgress] = useState<TimedReportProgress | null>(null);
  const [reportProgressTick, setReportProgressTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryContent, setRetryContent] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(TURN_TIME_LIMIT);
  const timerRef = useRef<number | null>(null);
  const timedOutRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const reportRedirectTimerRef = useRef<number | null>(null);
  const streamBufferRef = useRef("");
  const streamContentRef = useRef("");
  const streamFlushTimerRef = useRef<number | null>(null);
  const activeStreamMessageIdRef = useRef<string | null>(null);
  const streamSpeakerRef = useRef({ speaker: "对方", role: "" });
  const streamRoundIndexRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    getSession(sessionId)
      .then((result) => {
        setDetail(result);
        setScenario(result.scenario);
        setMessages(result.messages.filter(isVisibleChatMessage));
        setAgentTrace(result.agent_trace ?? []);
        setReportGenerating(false);
        setReportProgress(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [sessionId]);

  const currentRound = detail?.session.round ?? 0;
  const isUserTurn = !sending && !reportGenerating && detail?.session.status === "running";
  const timeWarning = timeRemaining <= WARNING_THRESHOLD && isUserTurn;

  // Timer: countdown + timeout handled from a fixed deadline so refreshes and tab throttling do not break it.
  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isUserTurn) {
      timedOutRef.current = false;
      setTimeRemaining(TURN_TIME_LIMIT);
      return;
    }

    const deadline = Date.now() + TURN_TIME_LIMIT * 1000;
    timedOutRef.current = false;
    setTimeRemaining(TURN_TIME_LIMIT);
    timerRef.current = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeRemaining(next);
      if (next <= 0 && !timedOutRef.current) {
        timedOutRef.current = true;
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        window.setTimeout(() => {
          void handleSubmit(AUTO_TIMEOUT_MESSAGE, { appendUserMessage: false });
        }, 0);
      }
    }, 250);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserTurn, sessionId, currentRound]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: sending || reportGenerating ? "auto" : "smooth", block: "end" });
  }, [messages, sending, reportGenerating]);

  useEffect(() => {
    if (!reportGenerating) return;
    const timer = window.setInterval(() => {
      setReportProgressTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [reportGenerating]);

  useEffect(() => {
    return () => {
      if (reportRedirectTimerRef.current) {
        window.clearTimeout(reportRedirectTimerRef.current);
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      if (streamFlushTimerRef.current) {
        window.clearTimeout(streamFlushTimerRef.current);
      }
    };
  }, []);

  const maxRound = scenario?.maxRound ?? DEFAULT_MAX_ROUND;
  const statusText = detail?.session.status === "finished" ? "评估已结束" : sending ? "对方正在组织回复" : "评估进行中";
  const presentation = getScenarioPresentation(scenario);
  const reportProgressPercent = clampProgressPercent(reportProgress?.percent);
  const reportProgressNow = useMemo(() => Date.now(), [reportProgressTick, reportProgress?.receivedAt]);
  const reportProgressElapsedMs = reportProgress
    ? Math.max(reportProgress.elapsedMs ?? 0, reportProgressNow - reportProgress.startedAt)
    : 0;
  const reportProgressStaleMs = reportProgress ? reportProgressNow - reportProgress.receivedAt : 0;
  const reportProgressDelayed = reportProgress ? reportProgress.delayed || reportProgressStaleMs >= REPORT_PROGRESS_STALE_MS : false;
  const reportProgressMessage = reportProgress?.message ?? "对话已结束，正在生成观察报告…";
  const visibleMessages = useMemo(() => messages.filter(isVisibleChatMessage), [messages]);

  function clearStreamFlushTimer() {
    if (streamFlushTimerRef.current) {
      window.clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
  }

  function resetStreamingState(messageId: string | null = null, roundIndex = 0) {
    clearStreamFlushTimer();
    streamBufferRef.current = "";
    streamContentRef.current = "";
    activeStreamMessageIdRef.current = messageId;
    streamSpeakerRef.current = { speaker: "对方", role: "" };
    streamRoundIndexRef.current = roundIndex;
  }

  function replaceOrAppendMessage(current: Message[], targetIds: string[], message: Message): Message[] {
    let replaced = false;
    const next = current.map((item) => {
      if (targetIds.includes(item.id)) {
        replaced = true;
        return message;
      }
      return item;
    });
    return replaced ? next : [...next, message];
  }

  function flushStreamingTokens() {
    clearStreamFlushTimer();

    const activeMessageId = activeStreamMessageIdRef.current;
    const chunk = streamBufferRef.current;
    if (!activeMessageId || !chunk) {
      return;
    }

    streamBufferRef.current = "";
    streamContentRef.current += chunk;
    const nextContent = streamContentRef.current;

    setMessages((current) => {
      const streamMessage: Message = {
        id: activeMessageId,
        senderType: "agent",
        senderName: streamSpeakerRef.current.speaker,
        senderRole: streamSpeakerRef.current.role,
        content: nextContent,
        roundIndex: streamRoundIndexRef.current
      };
      return replaceOrAppendMessage(current, [activeMessageId, typingMessageId], streamMessage);
    });
  }

  function scheduleStreamingFlush() {
    if (streamFlushTimerRef.current) {
      return;
    }

    streamFlushTimerRef.current = window.setTimeout(() => {
      flushStreamingTokens();
    }, STREAM_FLUSH_INTERVAL_MS);
  }

  async function handleSubmit(content: string, options: { appendUserMessage?: boolean } = {}) {
    if (!sessionId || sending || reportGenerating) {
      return;
    }

    const appendUserMessage = options.appendUserMessage ?? true;
    const currentRound = detail?.session.round ?? 0;
    const now = Date.now();
    const localMessage: Message = {
      id: `local-${now}`,
      senderType: "user",
      senderName: userNickname,
      senderRole: "参与者",
      content,
      roundIndex: currentRound
    };
    const typingMessage: Message = {
      id: typingMessageId,
      senderType: "typing",
      senderName: "对方",
      senderRole: "正在组织回复",
      content: "",
      roundIndex: currentRound + 1
    };

    setMessages((current) => {
      const cleanMessages = current.filter((m) => m.id !== typingMessageId);
      return appendUserMessage ? [...cleanMessages, localMessage, typingMessage] : [...cleanMessages, typingMessage];
    });
    setSending(true);
    setError(null);
    setRetryContent(null);
    setReportProgress(null);
    const startedAt = performance.now();
    const streamMsgId = `agent-streaming-${now}`;
    resetStreamingState(streamMsgId, currentRound + 1);

    // Use streaming for perceptual responsiveness
    await sendMessageStream(sessionId, content, {
      onJudging: () => {
        // The orchestration agent decided to finish; scoring is about to run.
        // Clear typing and show the report generation state.
        setMessages((current) => current.filter((m) => m.id !== typingMessageId));
        setSending(false);
        const judgingMessage: Message = {
          id: reportGeneratingMessageId,
          senderType: "agent",
          senderName: "评估系统",
          senderRole: "分析中",
          content: "对话已结束，正在生成观察报告…",
          roundIndex: currentRound + 1
        };
        setMessages((current) => [
          ...current.filter((m) => m.id !== reportGeneratingMessageId),
          judgingMessage
        ]);
        setReportGenerating(true);
        const receivedAt = Date.now();
        setReportProgress({
          stage: "preparing",
          message: "对话已结束，正在整理材料。",
          percent: 5,
          startedAt: receivedAt,
          receivedAt
        });
      },
      onReportProgress: (progress) => {
        const receivedAt = Date.now();
        setReportGenerating(true);
        setReportProgress((current) => ({
          ...progress,
          percent: clampProgressPercent(progress.percent),
          startedAt: current?.startedAt ?? receivedAt,
          receivedAt
        }));
      },
      onAgentTrace: (event) => {
        setAgentTrace((current) => mergeTraceEvents(current, [event]));
      },
      onSpeaker: (speaker, role) => {
        // Replace typing indicator with the real speaker identity
        activeStreamMessageIdRef.current = streamMsgId;
        streamSpeakerRef.current = { speaker, role };
        setMessages((current) =>
          replaceOrAppendMessage(current, [typingMessageId, streamMsgId], {
            id: streamMsgId,
            senderType: "agent",
            senderName: speaker,
            senderRole: role,
            content: streamContentRef.current,
            roundIndex: currentRound + 1
          })
        );
      },
      onToken: (token) => {
        streamBufferRef.current += token;
        scheduleStreamingFlush();
      },
      onDone: (result) => {
        flushStreamingTokens();
        if (result.agent_trace?.length) {
          setAgentTrace((current) => mergeTraceEvents(current, result.agent_trace ?? []));
        }
        // 流式返回的报告同样可能字段缺失，统一补齐后再入库/渲染，避免整页崩溃。
        const doneReport = result.report ? normalizeReport(result.report) : undefined;

        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          senderType: "agent",
          senderName: result.reply.speaker,
          senderRole: result.reply.role,
          content: result.reply.content,
          roundIndex: result.round
        };

        if (result.finished) {
          // Report is already generated — show final state and redirect shortly
          const formalReport =
            doneReport?.report_status === "confident" && !doneReport?.mock_generated;
          const reportSummary = formalReport
            ? `评估完成 · 参考指数 ${doneReport?.total_score ?? "—"} / ${doneReport?.dimension_scores ? Object.keys(doneReport.dimension_scores).length * 20 : 100} · 观察区间 ${doneReport?.level ?? "—"}`
            : `评估完成 · 报告已生成 · ${doneReport?.level ?? "观察反馈"}`;
          const doneMessage: Message = {
            id: reportGeneratingMessageId,
            senderType: "agent",
            senderName: "评估系统",
            senderRole: "报告已生成",
            content: reportSummary,
            roundIndex: result.round
          };

          setMessages((current) => [
            ...current.filter((m) => m.id !== streamMsgId && m.id !== typingMessageId && m.id !== reportGeneratingMessageId),
            agentMessage,
            doneMessage
          ]);
          setDetail((current) =>
            current
              ? {
                  ...current,
                  session: {
                    ...current.session,
                    round: result.round,
                    status: "finished",
                    reportJson: doneReport ?? current.session.reportJson
                  },
                  agent_trace: result.agent_trace ?? current.agent_trace
                }
              : current
          );
          setSending(false);
          setReportProgress((current) => current ? { ...current, stage: "done", percent: 100, message: "行为观察报告已生成。", receivedAt: Date.now() } : current);
          reportRedirectTimerRef.current = window.setTimeout(() => {
            navigate(`/report/${sessionId}`);
          }, 1500);
          setRetryContent(null);
        } else {
          setMessages((current) =>
            replaceOrAppendMessage(current, [streamMsgId, typingMessageId], agentMessage)
          );
          setSending(false);
          setDetail((current) =>
            current
              ? {
                  ...current,
                  session: {
                    ...current.session,
                    round: result.round,
                    status: current.session.status,
                    reportJson: doneReport ?? current.session.reportJson
                  },
                  agent_trace: result.agent_trace ?? current.agent_trace
                }
              : current
          );
          setRetryContent(null);
        }
        resetStreamingState();
      },
      onError: (msg) => {
        resetStreamingState();
        setMessages((current) => current.filter((m) => m.id !== typingMessageId && m.id !== streamMsgId));
        console.error("[chat:error]", { sessionId, round: currentRound, error: msg });
        setError(msg);
        setRetryContent(content);
        setSending(false);
        setReportGenerating(false);
        setReportProgress(null);
      }
    });
  }

  function retryLastMessage() {
    if (retryContent) {
      void handleSubmit(retryContent, { appendUserMessage: false });
    }
  }

  return (
    <main className="wrap chat-wrap">
      {timeWarning ? <div className="time-warning-overlay" /> : null}
      <header className="scene-head">
        <div>
          <h2 className="h2">{scenario?.title ?? "评估会话"}</h2>
          <div className="sub">
            <span className="live-dot" />
            {presentation.badge} · 第 {currentRound}/{maxRound} 轮 · {statusText}
          </div>
        </div>
        <span className="kicker">Assessment · Live</span>
      </header>

      <div className="thread" aria-live="polite">
        {visibleMessages.map((message, index) => (
          <div
            key={message.id}
            style={{ display: "contents", "--d": `${Math.min(index * 0.08, 0.4)}s` } as CSSProperties}
          >
            <ChatBubble message={message} />
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <AgentRunStrip trace={agentTrace} active={sending || reportGenerating} />

      {error ? (
        <div className="error-box" role="alert">
          <span>{error}</span>
          {retryContent && detail?.session.status === "running" ? (
            <button type="button" className="btn btn-ghost" onClick={retryLastMessage} disabled={sending || reportGenerating}>
              重试发送
            </button>
          ) : null}
        </div>
      ) : null}

      {reportGenerating ? (
        <div className="rg-panel glass" role="status" aria-live="polite">
          <div className="rg-top">
            <span>{reportProgressMessage}</span>
            <strong>{reportProgressPercent}%</strong>
          </div>
          <div
            className="rg-bar"
            role="progressbar"
            aria-label="行为观察报告生成进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={reportProgressPercent}
          >
            <div className="fill" style={{ width: `${reportProgressPercent}%` }} />
          </div>
          <div className="rg-meta">
            <span>{sampleProgressText(reportProgress)}</span>
            <span>
              {reportProgressDelayed
                ? "模型返回较慢，完成后继续更新"
                : `已等待 ${formatElapsed(reportProgressElapsedMs)}`}
            </span>
          </div>
        </div>
      ) : detail?.session.status === "finished" ? (
        <Link className="primary-link" to={`/report/${sessionId}`}>
          查看报告
        </Link>
      ) : (
        <MessageInput
          disabled={sending || reportGenerating || !detail}
          onSubmit={handleSubmit}
          timeRemaining={isUserTurn ? timeRemaining : TURN_TIME_LIMIT}
          timeWarning={timeWarning}
        />
      )}
    </main>
  );
}
