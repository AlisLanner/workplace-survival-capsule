import { describe, expect, it } from "vitest";
import {
  DIMENSION_IDS,
  equalWeights,
  heuristicImportance,
  isEqualWeights,
  parseWeightsInput,
  validateWeights,
  weightsFromFreeText,
  weightsFromImportance,
  weightsFromNumeric,
  weightedScores
} from "../src/assessment/weights";
import { assembleDefinition, isCustomVersion, templateParts, validateCustomDefinition } from "../src/assessment/customScenario";
import { applyParsedDocument, parseScenarioDocument, renderScenarioDocument } from "../src/assessment/scenarioDoc";
import { aggregateSamples, type JudgeSample } from "../src/assessment/judge";
import { initialState } from "../src/assessment/coverage";
import type { DimensionResult, Snapshot } from "../src/assessment/types";

function ratedDimensions(scores: number[]): DimensionResult[] {
  return DIMENSION_IDS.map((id, i) => ({
    id,
    name: `维度${i + 1}`,
    score: scores[i],
    status: "rated",
    analysis: "测试",
    slot_results: []
  }));
}

describe("维度权重解析与校验", () => {
  it("等权为默认且与旧版加和一致", () => {
    const w = equalWeights();
    expect(isEqualWeights(w)).toBe(true);
    const scores = [10, 12, 14, 16, 18, 20, 8, 6];
    const weighted = weightedScores(ratedDimensions(scores), w);
    expect(weighted).not.toBeNull();
    expect(weighted!.weighted_total).toBe(scores.reduce((a, b) => a + b, 0));
  });

  it("重要程度评级归一化且权重和为1", () => {
    const w = weightsFromImportance({ GE01: 5, GE02: 4, GE03: 3, GE04: 3, GE05: 3, GE06: 3, GE07: 3, GE08: 3 });
    const sum = DIMENSION_IDS.reduce((acc, id) => acc + w.weights[id], 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
    expect(w.weights.GE01).toBeGreaterThan(w.weights.GE02);
    expect(() => validateWeights(w)).not.toThrow();
  });

  it("数值权重按比例归一化", () => {
    const w = weightsFromNumeric({ GE01: 30, GE02: 20, GE03: 10, GE04: 10, GE05: 10, GE06: 10, GE07: 5, GE08: 5 });
    expect(w.weights.GE01).toBeCloseTo(0.3, 3);
    expect(() => weightsFromNumeric({ GE01: 0, GE02: 1, GE03: 1, GE04: 1, GE05: 1, GE06: 1, GE07: 1, GE08: 1 })).toThrow();
  });

  it("大白话关键词映射到评级", () => {
    expect(heuristicImportance("这个维度至关重要，是岗位核心")).toBe(5);
    expect(heuristicImportance("很重要，需要重点看")).toBe(4);
    expect(heuristicImportance("一般重要就行")).toBe(3);
    expect(heuristicImportance("相对次要")).toBe(2);
    expect(heuristicImportance("不重要，几乎不用关注")).toBe(1);
  });

  it("free_text 模式下显式评级优先于关键词", () => {
    const w = weightsFromFreeText(
      { GE01: "随便说说", GE02: "", GE03: "", GE04: "", GE05: "", GE06: "", GE07: "", GE08: "" },
      { GE01: 5 }
    );
    expect(w.importance!.GE01).toBe(5);
    expect(w.importance!.GE02).toBe(3);
  });

  it("parseWeightsInput 拒绝非法模式与缺键", () => {
    expect(() => parseWeightsInput({ mode: "unknown" })).toThrow();
    expect(() => parseWeightsInput({ mode: "importance", importance: { GE01: 3 } })).toThrow();
  });

  it("加权总分按 8×Σ(w·s) 计算且缺维时不合成", () => {
    const w = weightsFromImportance({ GE01: 5, GE02: 3, GE03: 3, GE04: 3, GE05: 3, GE06: 3, GE07: 3, GE08: 3 });
    // 权重和 26 → GE01=5/26, 其余 3/26
    const scores = [20, 10, 10, 10, 10, 10, 10, 10];
    const weighted = weightedScores(ratedDimensions(scores), w)!;
    const expected = 8 * ((5 / 26) * 20 + 7 * (3 / 26) * 10);
    expect(weighted.weighted_total).toBe(Math.round(expected));
    expect(weighted.weighted_percent).toBeCloseTo(((5 / 26) * 20 + 7 * (3 / 26) * 10) / 20 * 100, 0);
    const partial = ratedDimensions(scores);
    partial[3].status = "insufficient";
    partial[3].score = null;
    expect(weightedScores(partial, w)).toBeNull();
  });

  it("aggregateSamples 在 confident 时输出与定义权重一致的加权总分", () => {
    const parts = templateParts({ title: "聚合测试", user_role: "值班主管", scenario_desc: "周末高峰人手不足，需要现场调度。" });
    const weights = weightsFromImportance({ GE01: 5, GE02: 3, GE03: 3, GE04: 3, GE05: 3, GE06: 3, GE07: 3, GE08: 3 });
    const d = assembleDefinition(structuredClone(parts), { scenarioId: "custom-agg1", scenarioCode: "U9", version: "custom-20261025-agg001", weights, maxRound: 12 });
    const snapshot = {
      schema_version: d.schema_version,
      definition: d,
      definition_hash: "test",
      code_sha: "test",
      prompts: {},
      prompt_bundle_hash: "test",
      model: { mock: false }
    } as unknown as Snapshot;
    const state = initialState(d);
    const mkSample = (score: number): JudgeSample => ({
      dimension_results: d.dimensions.map(
        (dim) =>
          ({
            id: dim.id,
            name: dim.name,
            score,
            status: "rated",
            analysis: `一致解释${score}`,
            slot_results: d.slots.filter((s) => s.dimension_id === dim.id).map((s) => ({ slot_id: s.slot_id, opportunity: [], sufficiency: "sufficient", valence: "support", evidence: [] }))
          }) as DimensionResult
      )
    });
    const report = aggregateSamples([mkSample(12), mkSample(12), mkSample(12), mkSample(12), mkSample(12)], snapshot, state);
    expect(report.report_status).toBe("confident");
    expect(report.total_score).toBe(96);
    expect(report.weighted_scores).not.toBeNull();
    expect(report.weighted_scores!.weighted_total).toBe(Math.round(8 * (12 * 5 / 26 + 7 * 12 * 3 / 26)));
    expect(report.weighted_scores!.weights.weights.GE01).toBeCloseTo(5 / 26, 3);
  });
});

describe("自定义场景生成与校验", () => {
  const brief = {
    title: "门店开业冲刺",
    industry: "连锁餐饮",
    user_role: "门店店长",
    scenario_desc: "新店开业前三天，人手不足且供应链延迟，店长需要在不推迟开业的前提下稳住首店口碑。",
    job_requirements: "抗压、会排班、能协调总部与临时工",
    max_round: 12
  };

  it("模板生成能组装出通过校验的完整定义", () => {
    const parts = templateParts(brief);
    const definition = assembleDefinition(parts, { scenarioId: "custom-test1", scenarioCode: "U1", version: "custom-20261025-abc123" });
    expect(validateCustomDefinition(definition)).toBeUndefined();
    expect(definition.slots).toHaveLength(16);
    expect(definition.public_facts.length).toBeGreaterThanOrEqual(3);
    expect(definition.scoring_policy.evidence_policy).toBe("response-quality/1");
    expect(isCustomVersion(definition.assessment_version)).toBe(true);
  });

  it("校验能拒绝破坏契约的定义", () => {
    const parts = templateParts(brief);
    const definition = assembleDefinition(parts, { scenarioId: "custom-test2", scenarioCode: "U2", version: "custom-20261025-def456" });
    const broken = { ...definition, slots: definition.slots.slice(0, 15) };
    expect(() => validateCustomDefinition(broken)).toThrow("16个观察点");
    const broken2 = structuredClone(definition);
    broken2.assessment_version = "ge8-hacked";
    expect(() => validateCustomDefinition(broken2)).toThrow("custom-");
  });

  it("slot_id 与事件锚定符合运行契约", () => {
    const parts = templateParts(brief);
    const definition = assembleDefinition(parts, { scenarioId: "custom-test3", scenarioCode: "U3", version: "custom-20261025-fff000" });
    const slot10 = definition.slots[9];
    expect(slot10.trigger_event_ids).toEqual([`${definition.scenario_code}:limit`]);
    expect(slot10.required_fact_ids).toContain(`${definition.scenario_code}:L1`);
    const slot13 = definition.slots[12];
    expect(slot13.trigger_event_ids).toEqual([`${definition.scenario_code}:change`]);
    expect(definition.slots.every((s) => s.slot_id.startsWith("custom-20261025-fff000:"))).toBe(true);
  });

  it("每个维度的两个观察点与追问互不相同（含模型输出重复时的替换）", () => {
    const parts = templateParts(brief);
    const definition = assembleDefinition(parts, { scenarioId: "custom-test4", scenarioCode: "U4", version: "custom-20261025-eee111" });
    for (let i = 0; i < 16; i += 2) {
      expect(definition.slots[i].observation).not.toBe(definition.slots[i + 1].observation);
      expect(definition.slots[i].probe_intent).not.toBe(definition.slots[i + 1].probe_intent);
    }
    // 模型输出同维两点完全相同时，模板补齐须替换为不同侧面的观察点。
    const duplicated = templateParts(brief);
    (["GE05", "GE06"] as const).forEach((id) => {
      duplicated.slots[id] = [
        { observation: "重复的观察点描述", probe_intent: "重复的追问", target_agent: "leader" },
        { observation: "重复的观察点描述", probe_intent: "重复的追问", target_agent: "coworker" }
      ];
    });
    const deduped = assembleDefinition(duplicated, { scenarioId: "custom-test5", scenarioCode: "U5", version: "custom-20261025-eee222" });
    for (let i = 0; i < 16; i += 2) {
      expect(deduped.slots[i].observation).not.toBe(deduped.slots[i + 1].observation);
    }
  });
});

describe("场景文档导出与回传解析", () => {
  const brief = {
    title: "门店开业冲刺",
    user_role: "门店店长",
    scenario_desc: "新店开业前三天人手不足，需要稳住口碑。"
  };
  const parts = templateParts(brief);
  const definition = assembleDefinition(parts, { scenarioId: "custom-doc1", scenarioCode: "U1", version: "custom-20261025-doc111" });
  const weights = weightsFromImportance({ GE01: 5, GE02: 3, GE03: 3, GE04: 3, GE05: 3, GE06: 3, GE07: 3, GE08: 3 });

  it("导出文档包含全部结构段落并可逆向解析", () => {
    const doc = renderScenarioDocument({ scenario: { id: "custom-doc1", title: definition.title, status: "active", assessmentVersion: definition.assessment_version, origin: "custom", groupChatEnabled: true }, definition, weights, sessionCount: 0 });
    expect(doc.markdown).toContain("## 一、基本信息");
    expect(doc.markdown).toContain("## 六、十六个观察点");
    expect(doc.markdown).toContain("## 七、八维权重");
    const parsed = parseScenarioDocument(doc.markdown);
    expect(parsed.matched.slots).toBe(16);
    expect(parsed.matched.facts).toBeGreaterThanOrEqual(6);
    expect(parsed.matched.weights).toBe(8);
    expect(parsed.weights.importance!.GE01).toBe(5);
    expect(parsed.title).toBe(definition.title);
    expect(parsed.user_role).toBe(definition.user_role);
  });

  it("编辑后的文档能把改动套用回定义", () => {
    const doc = renderScenarioDocument({ scenario: { id: "custom-doc1", title: definition.title, status: "active", assessmentVersion: definition.assessment_version, origin: "custom", groupChatEnabled: true }, definition, weights, sessionCount: 0 });
    const edited = doc.markdown
      .replace(`- 场景标题：${definition.title}`, "- 场景标题：门店开业冲刺（修订）")
      .replace(`- [${definition.public_facts[0].id}] ${definition.public_facts[0].text}`, `- [${definition.public_facts[0].id}] 修改后的第一条事实`)
      .replace(/\[GE01 [^\]]*\] 重要程度：5\/5/, "[GE01 领导与决策] 重要程度：3/5")
      .replace("（在这里写下你的修改要求；上传后系统会按意见调整场景。留空表示没有额外意见。）", "把上级角色改得更强势一点。");
    const parsed = parseScenarioDocument(edited);
    expect(parsed.title).toBe("门店开业冲刺（修订）");
    expect(parsed.instruction).toContain("更强势");
    expect(parsed.publicFacts[definition.public_facts[0].id]).toBe("修改后的第一条事实");
    expect(parsed.weights.importance!.GE01).toBe(3);
    const applied = applyParsedDocument(definition, parsed);
    expect(applied.definition.title).toContain("修订");
    expect(applied.definition.public_facts[0].text).toBe("修改后的第一条事实");
    expect(applied.changed.length).toBeGreaterThan(0);
    expect(() => validateCustomDefinition(applied.definition)).not.toThrow();
  });
});
