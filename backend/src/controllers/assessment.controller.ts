import type { Request, Response } from "express";
import {
  getAssessmentReport,
  getAssessmentSession,
  listActiveScenarios,
  sendAssessmentMessage,
  sendAssessmentMessageStreaming,
  startAssessment
} from "../services/assessment.service";

export async function listScenariosController(_req: Request, res: Response) {
  const scenarios = await listActiveScenarios();
  res.json(scenarios);
}

export async function startAssessmentController(req: Request, res: Response) {
  const result = await startAssessment({
    user_id: req.body.user_id,
    nickname: req.body.nickname,
    scenario_id: req.body.scenario_id
  });
  res.status(201).json(result);
}

export async function sendMessageController(req: Request, res: Response) {
  const result = await sendAssessmentMessage(req.body.session_id, req.body.content ?? "");
  res.json(result);
}

export async function getSessionController(req: Request, res: Response) {
  const result = await getAssessmentSession(req.params.sessionId);
  res.json(result);
}

export async function getAssessmentReportController(req: Request, res: Response) {
  const result = await getAssessmentReport(req.params.sessionId);
  res.json(result);
}

type ReportProgressPayload = {
  stage: string;
  message: string;
  percent: number;
  current?: number;
  total?: number;
  elapsedMs?: number;
  delayed?: boolean;
};

export async function sendMessageStreamController(req: Request, res: Response) {
  // SSE setup
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  let closed = false;
  let reportProgressStartedAt = 0;
  let lastReportProgress: ReportProgressPayload | null = null;
  let reportProgressTimer: NodeJS.Timeout | null = null;

  const sendSSE = (event: string, data: unknown) => {
    if (closed) return;
    res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
    (res as Response & { flush?: () => void }).flush?.();
  };

  const stopReportProgressHeartbeat = () => {
    if (reportProgressTimer) {
      clearInterval(reportProgressTimer);
      reportProgressTimer = null;
    }
  };

  const startReportProgressHeartbeat = () => {
    if (reportProgressTimer) return;
    reportProgressStartedAt = reportProgressStartedAt || Date.now();
    reportProgressTimer = setInterval(() => {
      const base = lastReportProgress ?? {
        stage: "judge_sampling",
        percent: 12,
        message: "报告生成中，正在等待模型返回。"
      };
      sendSSE("report_progress", {
        ...base,
        delayed: true,
        elapsedMs: Date.now() - reportProgressStartedAt,
        message: `${base.message ?? "报告生成中"} 当前阶段耗时较长，请保持页面打开。`
      });
    }, 12000);
  };

  const safeEnd = () => {
    stopReportProgressHeartbeat();
    if (res.writableEnded || res.destroyed) return;
    closed = true;
    try { res.end(); } catch { /* already closed */ }
  };

  res.on("close", () => {
    closed = true;
    stopReportProgressHeartbeat();
  });

  res.flushHeaders?.();
  sendSSE("open", { ok: true });

  await sendAssessmentMessageStreaming(req.body.session_id, req.body.content ?? "", {
    onSpeaker: (speaker, role) => {
      sendSSE("speaker", { speaker, role });
    },
    onToken: (token) => {
      sendSSE("token", token);
    },
    onAgentTrace: (event) => {
      sendSSE("agent_trace", event);
      if (event.eventType === "handoff" && event.payload && typeof event.payload === "object") {
        sendSSE("handoff", event.payload);
      }
    },
    onJudging: () => {
      reportProgressStartedAt = Date.now();
      lastReportProgress = {
        stage: "preparing",
        percent: 5,
        message: "测评结束，正在整理报告材料。",
        elapsedMs: 0
      };
      sendSSE("judging", { message: "测评结束，正在生成行为观察报告" });
      sendSSE("report_progress", lastReportProgress);
      startReportProgressHeartbeat();
    },
    onReportProgress: (progress) => {
      lastReportProgress = progress;
      sendSSE("report_progress", progress);
      if (progress.stage === "done") {
        stopReportProgressHeartbeat();
      }
    },
    onDone: (result) => {
      stopReportProgressHeartbeat();
      sendSSE("done", result);
      safeEnd();
    },
    onError: (message) => {
      stopReportProgressHeartbeat();
      sendSSE("error", { error: message });
      safeEnd();
    }
  });

  safeEnd();
}
