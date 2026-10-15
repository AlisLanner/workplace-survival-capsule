import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JudgeReport } from "../src/types/agent";

const mocks = vi.hoisted(() => ({
  callDeepSeek: vi.fn(),
  getPromptContent: vi.fn(),
  log: vi.fn()
}));

vi.mock("../src/services/llm.service", () => ({
  callDeepSeek: mocks.callDeepSeek
}));

vi.mock("../src/services/prompt.service", () => ({
  getPromptContent: mocks.getPromptContent
}));

vi.mock("../src/utils/logger", () => ({
  log: mocks.log
}));

import { callJudgeAgent } from "../src/agents/judge.agent";

function makeReport(label: string, scores: Record<string, number>): JudgeReport {
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);

  return {
    total_score: total,
    level: label,
    dimension_scores: scores,
    dimension_analysis: Object.fromEntries(Object.keys(scores).map((key) => [key, `${label}-${key}`])),
    conflict_style: "测试型",
    summary: `summary-${label}`,
    strengths: [`strength-${label}`],
    risks: [`risk-${label}`],
    suggestions: [`suggestion-${label}`],
    evidence: Object.keys(scores).map((dimension) => ({
      dimension,
      quote: `quote-${label}-${dimension}`,
      analysis: `analysis-${label}-${dimension}`
    })),
    radar_chart_data: Object.entries(scores).map(([name, score]) => ({ name, score, max: 20 })),
    final_recommendation: `recommendation-${label}`
  };
}

describe("judge agent aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.USE_MOCK_LLM;
    mocks.getPromptContent.mockResolvedValue("judge prompt");
  });

  it("uses five-sample trimmed mean instead of median for final dimension scores", async () => {
    const reports = [
      makeReport("sample-1", { "备选方案": 2, "横向协商": 1 }),
      makeReport("sample-2", { "备选方案": 4, "横向协商": 2 }),
      makeReport("sample-3", { "备选方案": 7, "横向协商": 4 }),
      makeReport("sample-4", { "备选方案": 8, "横向协商": 4 }),
      makeReport("sample-5", { "备选方案": 10, "横向协商": 20 })
    ];

    for (const report of reports) {
      mocks.callDeepSeek.mockResolvedValueOnce(JSON.stringify(report));
    }

    const result = await callJudgeAgent({
      blackboard: {},
      chatHistory: "用户：测试修剪均值聚合。",
      groupSummary: {}
    });

    expect(mocks.callDeepSeek).toHaveBeenCalledTimes(5);
    expect(result.report.dimension_scores["备选方案"]).toBe(6.33);
    expect(result.report.dimension_scores["备选方案"]).not.toBe(7);
    expect(result.report.dimension_scores["横向协商"]).toBe(3.33);
    expect(result.report.total_score).toBe(9.66);
    expect(result.report.radar_chart_data).toEqual([
      { name: "备选方案", score: 6.33, max: 20 },
      { name: "横向协商", score: 3.33, max: 20 }
    ]);
    expect(result.report.calibration_issues).toBeUndefined();
    expect(result.samplingStats.scores).toEqual(reports.map((report) => report.total_score));
  });

  it("does not fall back to mock scoring when judge JSON is invalid", async () => {
    mocks.callDeepSeek.mockResolvedValueOnce("{not valid json");

    await expect(
      callJudgeAgent({
        blackboard: {},
        chatHistory: "用户：测试 Judge 失败时不应生成 mock 报告。",
        groupSummary: {}
      })
    ).rejects.toThrow();
  });

  it("marks reports as unfit for formal scoring when judge samples diverge too much", async () => {
    const dims = ["信息辨别", "交付切分", "备选方案", "承诺边界", "向上对齐", "横向协商", "新人赋能", "压力表达"];
    const sampleValues = [0, 10, 12, 14, 20];
    const reports = sampleValues.map((score, index) =>
      makeReport(
        `sample-${index + 1}`,
        Object.fromEntries(dims.map((dim) => [dim, score]))
      )
    );

    for (const report of reports) {
      mocks.callDeepSeek.mockResolvedValueOnce(JSON.stringify(report));
    }

    const result = await callJudgeAgent({
      blackboard: {},
      chatHistory: "用户：测试 Judge 高分歧时不应给正式结论。",
      groupSummary: {}
    });

    expect(result.samplingStats.variance).toBeGreaterThanOrEqual(80);
    expect(result.report.level).toBe("待人工复核");
    expect(result.report.human_review_required).toBe(true);
    expect(result.report.human_review_reason).toContain("超过正式报告阈值");
    expect(result.report.summary).toContain("作为待复核草案");
  });

  it("marks explicit mock judge reports as debug-only", async () => {
    process.env.USE_MOCK_LLM = "true";
    const reports = Array.from({ length: 5 }, (_, index) =>
      makeReport(`mock-${index + 1}`, { "信息辨别": 10, "交付切分": 10 })
    );

    for (const report of reports) {
      mocks.callDeepSeek.mockResolvedValueOnce(JSON.stringify(report));
    }

    const result = await callJudgeAgent({
      blackboard: {},
      chatHistory: "用户：测试显式 mock Judge 不能作为正式评分。",
      groupSummary: {}
    });

    expect(result.report.mock_generated).toBe(true);
    expect(result.report.report_status).toBe("debug");
    expect(result.report.level).toBe("开发调试");
    expect(result.report.human_review_reason).toContain("USE_MOCK_LLM=true");
  });
});
