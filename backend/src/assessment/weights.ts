import type { DimensionId, DimensionResult } from "./types";

/**
 * 八维权重与加权计分。
 *
 * 计分模型：线性补偿模型（linear compensatory model），人事测评中加权合成分数的标准做法——
 * 各维度原始分（0—20，底层评分逻辑不变）按岗位权重线性加权求和：
 *   weighted_total = 8 × Σ(wᵢ·sᵢ)，其中 Σwᵢ = 1。
 * 乘 8 保持与旧版 0—160 总分同一量尺：等权（每维 1/8）时加权总分与旧版简单加和完全一致，
 * 保证历史可比性；权重越集中的维度对总分影响越大。
 *
 * 权重来源支持三种使用者输入（岗位分析常用做法）：
 *  1. importance：每维 1—5 重要程度评级（对应 O*NET/PAQ 等岗位分析问卷的重要性量表），
 *     权重 = 各维评级 / 评级总和（直接评级法）。
 *  2. numeric：直接给出每维权重（百分比或任意正数），系统归一化后使用。
 *  3. free_text：用大白话描述每维重要性，系统映射为 1—5 评级（真实模式由大模型映射，
 *     离线模式用关键词规则），再按 1 归一化。
 */

export const WEIGHTED_METHOD = "linear-compensatory/1";
export const TOTAL_SCALE = 160;
export const DIMENSION_MAX = 20;
export const DIMENSION_COUNT = 8;

export type DimensionWeightsMode = "equal" | "importance" | "numeric" | "free_text";

export interface DimensionWeights {
  mode: DimensionWeightsMode;
  /** 归一化权重，8 键齐全，总和约等于 1，保留 4 位小数。 */
  weights: Record<DimensionId, number>;
  /** 1—5 重要程度评级（importance/free_text 模式存在）。 */
  importance?: Record<DimensionId, number>;
  /** 使用者的大白话描述（free_text 模式存在），便于追溯口径。 */
  free_text?: Record<DimensionId, string>;
  /** numeric 模式下使用者给出的原始权重数值。 */
  numeric_input?: Record<DimensionId, number>;
  /** 权重如何得到的说明。 */
  note?: string;
  updated_at: string;
}

export interface WeightedContribution {
  id: string;
  name: string;
  score: number;
  weight: number;
  weighted_score: number;
}

export interface WeightedScores {
  method: string;
  weights: DimensionWeights;
  contributions: WeightedContribution[];
  weighted_total: number;
  weighted_percent: number;
  note: string;
}

export const DIMENSION_IDS: DimensionId[] = ["GE01","GE02","GE03","GE04","GE05","GE06","GE07","GE08"];

function isDimensionId(value: string): value is DimensionId {
  return (DIMENSION_IDS as string[]).includes(value);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor + Number.EPSILON) / factor;
}

function normalizeMap(input: Record<string, number>): Record<DimensionId, number> {
  const total = DIMENSION_IDS.reduce((sum, id) => sum + input[id], 0);
  const out = {} as Record<DimensionId, number>;
  for (const id of DIMENSION_IDS) out[id] = round(input[id] / total, 4);
  // 归一化后因舍入产生的微小残差补到权重最大的一维，保证总和恰好为 1。
  const residual = round(1 - DIMENSION_IDS.reduce((sum, id) => sum + out[id], 0), 4);
  if (residual !== 0) {
    const maxId = DIMENSION_IDS.reduce((a, b) => (out[a] >= out[b] ? a : b));
    out[maxId] = round(out[maxId] + residual, 4);
  }
  return out;
}

export function equalWeights(): DimensionWeights {
  return {
    mode: "equal",
    weights: Object.fromEntries(DIMENSION_IDS.map((id) => [id, 0.125])) as Record<DimensionId, number>,
    note: "未设置权重，八维等权（每维 1/8）。",
    updated_at: new Date().toISOString()
  };
}

export function weightsFromImportance(importance: Record<string, unknown>, note?: string): DimensionWeights {
  const ratings = readNumberMap(importance, 1, 5, "重要程度必须是 1—5 的数字");
  return {
    mode: "importance",
    weights: normalizeMap(Object.fromEntries(DIMENSION_IDS.map((id) => [id, ratings[id]]))),
    importance: ratings,
    note: note ?? "按每维 1—5 重要程度评级归一化（直接评级法）。",
    updated_at: new Date().toISOString()
  };
}

export function weightsFromNumeric(input: Record<string, unknown>, note?: string): DimensionWeights {
  const raw = readNumberMap(input, 0.0001, 1000, "权重必须是正数");
  for (const id of DIMENSION_IDS) {
    if (raw[id] <= 0) throw new Error(`${id} 权重必须大于 0；不重要的维度请用重要程度评级表达`);
  }
  return {
    mode: "numeric",
    weights: normalizeMap(raw),
    numeric_input: raw,
    note: note ?? "按给出的权重数值归一化（总和为 1）后使用。",
    updated_at: new Date().toISOString()
  };
}

function readNumberMap(input: Record<string, unknown>, min: number, max: number, message: string): Record<DimensionId, number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("必须是包含八个维度键的对象");
  const out = {} as Record<DimensionId, number>;
  for (const id of DIMENSION_IDS) {
    const value = Number(input[id]);
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${id}：${message}`);
    out[id] = value;
  }
  return out;
}

/** 离线关键词规则：把大白话映射为 1—5 评级。真实模式下由大模型映射，此规则作为兜底。 */
export function heuristicImportance(text: string): number {
  const t = (text ?? "").trim();
  if (/至关重|最重要|核心中的核心|第一优先|压倒性|决定性|首要/.test(t)) return 5;
  if (/很重|重点|优先|关键|高度关注|特别看重|着重/.test(t)) return 4;
  if (/不太重|次要|其次|较低|不太关|弱一点|不那么重/.test(t)) return 2;
  if (/不重要|几乎不|无所谓|最低|不用管|可以忽略|不关注/.test(t)) return 1;
  if (/一般|普通|同等|常规|正常|平均/.test(t)) return 3;
  return t ? 3 : 3;
}

export function weightsFromFreeText(
  freeText: Record<string, unknown>,
  importance: Record<string, unknown> | undefined,
  note?: string
): DimensionWeights {
  if (!freeText || typeof freeText !== "object" || Array.isArray(freeText)) throw new Error("必须是包含八个维度键的对象");
  const texts = {} as Record<DimensionId, string>;
  const ratings = {} as Record<DimensionId, number>;
  const explicit = importance && typeof importance === "object" && !Array.isArray(importance)
    ? Object.fromEntries(DIMENSION_IDS.map((id) => [id, Number((importance as Record<string, unknown>)[id])])) as Record<DimensionId, number>
    : undefined;
  for (const id of DIMENSION_IDS) {
    const raw = freeText[id];
    texts[id] = typeof raw === "string" ? raw.trim() : "";
    const manual = explicit?.[id];
    ratings[id] = manual !== undefined && Number.isFinite(manual) && manual >= 1 && manual <= 5 ? manual : heuristicImportance(texts[id]);
  }
  return {
    mode: "free_text",
    weights: normalizeMap(ratings),
    importance: ratings,
    free_text: texts,
    note: note ?? "由语言描述映射为 1—5 重要程度后归一化；映射结果请在保存前核对。",
    updated_at: new Date().toISOString()
  };
}

/** 管理端统一入口：按 mode 解析任意一种输入为规范权重对象。 */
export function parseWeightsInput(input: unknown): DimensionWeights {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("权重输入无效");
  const body = input as Record<string, unknown>;
  switch (body.mode) {
    case undefined:
    case null:
    case "":
    case "equal":
      return equalWeights();
    case "importance":
      return weightsFromImportance(body.importance as Record<string, unknown>, typeof body.note === "string" ? body.note : undefined);
    case "numeric":
      return weightsFromNumeric(body.weights as Record<string, unknown>, typeof body.note === "string" ? body.note : undefined);
    case "free_text":
      return weightsFromFreeText(
        body.free_text as Record<string, unknown>,
        body.importance as Record<string, unknown> | undefined,
        typeof body.note === "string" ? body.note : undefined
      );
    default:
      throw new Error(`未知权重模式：${String(body.mode)}；支持 equal / importance / numeric / free_text`);
  }
}

export function validateWeights(weights: unknown): DimensionWeights {
  const w = weights as DimensionWeights;
  if (!w || typeof w !== "object") throw new Error("权重配置无效");
  if (!["equal", "importance", "numeric", "free_text"].includes(w.mode)) throw new Error("权重模式无效");
  if (!w.weights || typeof w.weights !== "object") throw new Error("缺少权重表");
  for (const id of DIMENSION_IDS) {
    const value = Number(w.weights[id]);
    if (!Number.isFinite(value) || value <= 0 || value > 1) throw new Error(`${id} 权重无效（须为 0—1 之间的正数）`);
    if (!isDimensionId(id)) throw new Error("维度键无效");
  }
  const sum = round(DIMENSION_IDS.reduce((acc, id) => acc + Number(w.weights[id]), 0), 4);
  if (Math.abs(sum - 1) > 0.001) throw new Error(`权重总和须为 1，当前 ${sum}`);
  if (w.importance) {
    for (const id of DIMENSION_IDS) {
      const value = Number(w.importance[id]);
      if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error(`${id} 重要程度须为 1—5 整数`);
    }
  }
  if (typeof w.updated_at !== "string" || !w.updated_at) throw new Error("缺少更新时间");
  return w;
}

export function isEqualWeights(weights: DimensionWeights | undefined | null): boolean {
  if (!weights) return true;
  return DIMENSION_IDS.every((id) => Math.abs(weights.weights[id] - 0.125) < 0.00005);
}

/**
 * 计算加权合成分。仅当八个维度全部取得有效分数时输出总分（与旧版 total_score 的口径一致，
 * 缺失不补 0）；任一维度缺失时返回 null，避免用不完整信息合成误导性总分。
 */
export function weightedScores(results: DimensionResult[], weights: DimensionWeights | undefined): WeightedScores | null {
  const w = weights ?? equalWeights();
  if (results.length !== DIMENSION_COUNT) return null;
  const rated = results.filter((r) => r.status === "rated" && Number.isFinite(r.score!));
  if (rated.length !== DIMENSION_COUNT) return null;
  let weightedSum = 0;
  const contributions = results.map((r) => {
    const weight = Number(w.weights[r.id as DimensionId] ?? 0.125);
    const weightedScore = round(weight * r.score!, 2);
    weightedSum += weight * r.score!;
    return { id: r.id, name: r.name, score: r.score!, weight: round(weight, 4), weighted_score: weightedScore };
  });
  const weightedTotal = Math.round(weightedSum * DIMENSION_COUNT + 1e-9);
  return {
    method: WEIGHTED_METHOD,
    weights: w,
    contributions,
    weighted_total: weightedTotal,
    weighted_percent: round((weightedSum / DIMENSION_MAX) * 100, 1),
    note: `加权总分 = 8 × Σ(维度权重 × 维度得分)，满分 160 分；权重越高的维度对总分影响越大。`
  };
}

export function describeWeight(weight: number): string {
  if (weight >= 0.2) return "重点维度";
  if (weight >= 0.14) return "侧重维度";
  if (weight > 0.1) return "一般维度";
  return "次要维度";
}
