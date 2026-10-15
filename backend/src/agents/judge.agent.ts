import { callDeepSeek } from "../services/llm.service";
import { getPromptContent } from "../services/prompt.service";
import type { JudgeReport } from "../types/agent";

export type JudgeProgressStage =
  | "preparing"
  | "judge_sampling"
  | "aggregating"
  | "calibrating"
  | "saving"
  | "done";

export interface JudgeProgressEvent {
  stage: JudgeProgressStage;
  message: string;
  percent: number;
  current?: number;
  total?: number;
  elapsedMs?: number;
  delayed?: boolean;
}

type JudgeProgressCallback = (progress: JudgeProgressEvent) => void;

function emitProgress(onProgress: JudgeProgressCallback | undefined, progress: JudgeProgressEvent) {
  onProgress?.({
    ...progress,
    percent: Math.max(0, Math.min(100, Math.round(progress.percent)))
  });
}
import { log } from "../utils/logger";
import { renderTemplate } from "../utils/renderTemplate";
import { safeParseJSON } from "../utils/safeParseJSON";

async function callJudgeAgentOnce(params: {
  blackboard: unknown;
  chatHistory: string;
  groupSummary?: unknown;
}): Promise<JudgeReport> {
  const judgePrompt = await getPromptContent("judge");
  const input = renderTemplate(
    `
Full chat:
{chat_history}

Final Blackboard:
{blackboard}

Group summary:
{group_summary}
`,
    {
      chat_history: params.chatHistory,
      blackboard: JSON.stringify(params.blackboard, null, 2),
      group_summary: JSON.stringify(params.groupSummary ?? {}, null, 2)
    }
  );

  const raw = await callDeepSeek({
    systemPrompt: judgePrompt,
    userPrompt: input,
    model: process.env.DEEPSEEK_JUDGE_MODEL || process.env.DEEPSEEK_FAST_MODEL || process.env.DEEPSEEK_STRONG_MODEL,
    temperature: 0.1,
    maxTokens: 30000,
    jsonMode: true,
    thinking: true,
    timeoutMs: 240000,
    allowMockFallback: false
  });

  try {
    let report: JudgeReport;
    try {
      report = safeParseJSON<JudgeReport>(raw);
    } catch (parseError) {
      // DeepSeek JSON Output 官方提示"有概率返回空 content 或非 JSON"。
      // 单路采样解析失败时，用更强调 JSON 的修正提示词重试一次，避免该路直接失败拖垮整批采样。
      log("warn", "Judge parse failed; retrying once with stricter JSON instruction", {
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        rawPreview: raw.slice(0, 500)
      });
      const retryRaw = await callDeepSeek({
        systemPrompt: `${judgePrompt}\n\n请严格只输出上述 JSON 对象，不要输出任何说明、分析或 Markdown 代码块。`,
        userPrompt: input,
        model: process.env.DEEPSEEK_JUDGE_MODEL || process.env.DEEPSEEK_FAST_MODEL || process.env.DEEPSEEK_STRONG_MODEL,
        temperature: 0.1,
        maxTokens: 30000,
        jsonMode: true,
        thinking: false,
        timeoutMs: 240000,
        allowMockFallback: false
      });
      report = safeParseJSON<JudgeReport>(retryRaw);
    }
    if (process.env.USE_MOCK_LLM === "true") {
      return {
        ...report,
        mock_generated: true,
        report_status: "debug",
        human_review_required: true,
        human_review_reason: "USE_MOCK_LLM=true，本报告由本地模拟 Judge 生成，不能作为正式评分。"
      };
    }
    return report;
  } catch (error) {
    log("error", "Judge Agent returned invalid JSON; refusing to generate a mock-scored report", {
      error,
      rawPreview: raw.slice(0, 1000)
    });
    throw error;
  }
}

interface CalibrationResult {
  valid: boolean;
  issues: string[];
  fixedReport?: JudgeReport;
}

const MAX_REPORTABLE_TOTAL_VARIANCE = 80;

function calibrateJudgeReport(report: JudgeReport): CalibrationResult {
  const issues: string[] = [];
  const dimensionScores = report.dimension_scores ?? {};

  // Only enforce mathematical consistency; don't override Judge's dimension choices
  const dimKeys = Object.keys(dimensionScores);
  const dimSum = sumScores(dimKeys.map((key) => dimensionScores[key] ?? 0));

  if (report.total_score !== dimSum) {
    issues.push(`total_score ${report.total_score} != sum of dimensions ${dimSum}`);
  }

  for (const [key, score] of Object.entries(dimensionScores)) {
    if (typeof score !== "number" || score < 0 || score > 20) {
      issues.push(`dimension ${key} score ${score} out of 0-20 range`);
    }
  }

  if (issues.length === 0) return { valid: true, issues: [] };

  // Minimal fix: only correct total_score math and clamp out-of-range scores
  const fixed = { ...report };
  const fixedScores: Record<string, number> = {};
  for (const key of dimKeys) {
    const raw = dimensionScores[key];
    fixedScores[key] = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.min(20, raw)) : 0;
  }
  fixed.dimension_scores = fixedScores;
  fixed.total_score = sumScores(Object.values(fixedScores));
  fixed.calibration_issues = issues;

  return { valid: false, issues, fixedReport: fixed };
}

function applyReliabilityGate(report: JudgeReport, totalVariance: number): JudgeReport {
  if (totalVariance < MAX_REPORTABLE_TOTAL_VARIANCE) {
    return {
      ...report,
      report_status: report.report_status ?? "confident"
    };
  }

  const reason = `Judge 5次采样总分方差 ${totalVariance}，超过正式报告阈值 ${MAX_REPORTABLE_TOTAL_VARIANCE}`;
  return {
    ...report,
    level: "待人工复核",
    summary: `评分者间一致性不足，本次分数作为待复核草案。${report.summary}`,
    risks: ["评分者间一致性不足，分数稳定性不足。", ...(report.risks ?? [])],
    suggestions: ["重新采样或人工复核原始对话后，再确认正式分数。", ...(report.suggestions ?? [])],
    final_recommendation: `本次结果需要人工复核：${reason}。${report.final_recommendation}`,
    human_review_required: true,
    human_review_reason: reason,
    report_status: "unratable"
  };
}

function applyMockReportGate(report: JudgeReport): JudgeReport {
  if (!report.mock_generated) {
    return report;
  }

  const reason = "USE_MOCK_LLM=true，本报告由本地模拟 Judge 生成，不能作为正式评分。";
  return {
    ...report,
    level: "开发调试",
    summary: `本报告由本地 mock Judge 生成，用于开发调试。${report.summary}`,
    human_review_required: true,
    human_review_reason: reason,
    report_status: "debug"
  };
}

function trimmedMean(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const trimmed = sorted.length > 2 ? sorted.slice(1, -1) : sorted;
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumScores(values: Iterable<number>): number {
  let cents = 0;
  for (const value of values) {
    cents += Math.round(value * 100);
  }
  return cents / 100;
}

function dimDistance(a: Record<string, number>, b: Record<string, number>, dims: string[]): number {
  return dims.reduce((sum, d) => sum + Math.pow((a[d] ?? 0) - (b[d] ?? 0), 2), 0);
}

function popVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Number((values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length).toFixed(1));
}

function computeLevel(totalScore: number, dimCount: number): string {
  const ratio = totalScore / (dimCount * 20);
  if (ratio >= 0.875) return "卓越";
  if (ratio >= 0.75) return "优秀";
  if (ratio >= 0.6) return "良好";
  if (ratio >= 0.45) return "合格";
  return "待提升";
}

export async function callJudgeAgent(
  params: {
    blackboard: unknown;
    chatHistory: string;
    groupSummary?: unknown;
  },
  onProgress?: JudgeProgressCallback
): Promise<{ report: JudgeReport; samplingStats: { scores: number[]; variance: number; dimVariances?: Record<string, number> } }> {
  const startedAt = Date.now();
  const sampleTotal = 5;
  let completedSamples = 0;

  emitProgress(onProgress, {
    stage: "judge_sampling",
    current: 0,
    total: sampleTotal,
    percent: 12,
    message: "Judge Agent 采样准备中，正在等待模型返回。",
    elapsedMs: 0
  });

  // Run Judge 5 times in parallel. Progress advances only when a real sample returns.
  const reports = await Promise.all(
    Array.from({ length: sampleTotal }, () =>
      callJudgeAgentOnce(params).then((report) => {
        completedSamples += 1;
        emitProgress(onProgress, {
          stage: "judge_sampling",
          current: completedSamples,
          total: sampleTotal,
          percent: 12 + (completedSamples / sampleTotal) * 58,
          message: `Judge Agent 采样 ${completedSamples}/${sampleTotal} 完成`,
          elapsedMs: Date.now() - startedAt
        });
        return report;
      })
    )
  );

  emitProgress(onProgress, {
    stage: "aggregating",
    percent: 74,
    message: "正在聚合采样结果、维度均值和方差。",
    elapsedMs: Date.now() - startedAt
  });

  // Gather all dimension names across all 5 reports
  const allDims = new Set<string>();
  for (const r of reports) {
    for (const d of Object.keys(r.dimension_scores ?? {})) allDims.add(d);
  }
  const dimNames = [...allDims];

  // Per-dimension trimmed mean (drop min and max, average middle 3 of 5)
  const rawDimScores: Record<string, number> = {};
  const dimVariances: Record<string, number> = {};
  for (const dim of dimNames) {
    const rawScores = reports.map(r => r.dimension_scores?.[dim] ?? 0);
    rawDimScores[dim] = trimmedMean(rawScores);
    dimVariances[dim] = popVariance(rawScores);
  }

  const dimScores: Record<string, number> = {};
  for (const dim of dimNames) {
    dimScores[dim] = roundScore(rawDimScores[dim] ?? 0);
  }

  const totalScore = sumScores(Object.values(dimScores));

  // Find the full report that's the source of the closest dimension vector
  const anchorReport = reports.reduce((best, r) => {
    const rScores: Record<string, number> = {};
    for (const d of dimNames) rScores[d] = r.dimension_scores?.[d] ?? 0;
    const bestScores: Record<string, number> = {};
    for (const d of dimNames) bestScores[d] = best.dimension_scores?.[d] ?? 0;
    return dimDistance(rScores, rawDimScores, dimNames) < dimDistance(bestScores, rawDimScores, dimNames) ? r : best;
  });

  // Build composite report: trimmed-mean scores + text from closest report
  const report: JudgeReport = {
    ...anchorReport,
    total_score: totalScore,
    level: computeLevel(totalScore, dimNames.length),
    dimension_scores: dimScores,
    radar_chart_data: dimNames.map(d => ({ name: d, score: dimScores[d], max: 20 }))
  };

  // Calibrate (should rarely trigger since we construct scores mathematically)
  const calibration = calibrateJudgeReport(report);
  const finalReport = calibration.valid ? report : calibration.fixedReport!;

  const allTotalScores = reports.map(r => r.total_score);
  const totalVariance = popVariance(allTotalScores);
  emitProgress(onProgress, {
    stage: "calibrating",
    percent: 84,
    message: totalVariance >= MAX_REPORTABLE_TOTAL_VARIANCE
      ? "采样分歧较大，正在标记为人工复核。"
      : "正在校验报告一致性和可信边界。",
    elapsedMs: Date.now() - startedAt
  });

  const mockGenerated = reports.some((r) => r.mock_generated);
  const reliabilityGatedReport = applyMockReportGate(
    applyReliabilityGate({ ...finalReport, mock_generated: mockGenerated || finalReport.mock_generated }, totalVariance)
  );

  log("info", "Judge agent multi-sample complete (per-dimension trimmed mean)", {
    judgeCallId: `judge_${Date.now().toString(36)}`,
    samples: 5,
    totalScores: allTotalScores,
    trimmedTotal: totalScore,
    totalVariance,
    dimVariances,
    durationMs: Date.now() - startedAt
  });

  return {
    report: reliabilityGatedReport,
    samplingStats: { scores: allTotalScores, variance: totalVariance, dimVariances }
  };
}
