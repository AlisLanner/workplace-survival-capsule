import { DIMENSION_IDS } from "./weights";
import { dimensions } from "./definitions";
import type { DimensionWeights } from "./weights";
import type { Definition } from "./types";
import type { Scenario as ScenarioRow } from "@prisma/client";

/**
 * 场景配置文档（Markdown）的导出与回传解析。
 * 文档面向使用者（公司/HR/用人部门）审阅：可直接编辑文本后整篇上传回系统，
 * 系统按结构化标记解析覆盖对应字段；文末"修改意见"区的自由文字交给生成环节处理。
 */

export interface ScenarioDocumentInput {
  scenario: Pick<ScenarioRow, "id" | "title" | "status" | "assessmentVersion" | "origin" | "groupChatEnabled">;
  definition: Definition;
  weights: DimensionWeights;
  sessionCount: number;
}

const AGENT_LABEL: Record<string, string> = { leader: "上级", coworker: "同级协作方", client: "利益相关方" };

export function renderScenarioDocument(input: ScenarioDocumentInput): { markdown: string; filename: string } {
  const { scenario, definition: d, weights, sessionCount } = input;
  const lines: string[] = [];
  lines.push(`# 场景配置文档：${d.title}`);
  lines.push("");
  lines.push(`> 场景ID：${scenario.id} ｜ 测量版本：${d.assessment_version} ｜ 状态：${scenario.status === "active" ? "启用" : scenario.status}`);
  lines.push(`> 使用方法：直接修改下文各条目的文字，保存后整篇上传回系统即可更新场景；结构性编号（如 F1、U1-01、GE01）请保留。`);
  lines.push(`> 也可以不改正文，只在文末"八、修改意见"区写下修改要求。`);
  lines.push("");
  lines.push(`## 一、基本信息`);
  lines.push(`- 场景标题：${d.title}`);
  lines.push(`- 受测者角色：${d.user_role}`);
  lines.push(`- 对话轮次：最少 ${d.round_policy.min} 轮，最多 ${d.round_policy.max} 轮`);
  lines.push(`- 已产生测评会话：${sessionCount} 个（历史会话使用生成时的旧版本，不受本次修改影响）`);
  lines.push("");
  lines.push(`## 二、角色设定`);
  (["leader", "coworker", "client"] as const).forEach((agent) => {
    lines.push(`- [${agent}｜${AGENT_LABEL[agent]}] 名字：${d.roles[agent].name} ｜ 定位：${d.roles[agent].role}`);
  });
  lines.push("");
  lines.push(`## 三、公开事实（候选人可见的任务信息）`);
  d.public_facts.forEach((f) => lines.push(`- [${f.id}] ${f.text}`));
  lines.push("");
  lines.push(`## 四、角色私有事实（仅该角色知道，用于制造信息差）`);
  (["leader", "coworker", "client"] as const).forEach((agent) => {
    d.role_facts[agent].forEach((f) => lines.push(`- [${f.id}] ${f.text}`));
  });
  lines.push("");
  lines.push(`## 五、中途事件（对话过程中由角色说出的变化）`);
  d.events.forEach((e) => lines.push(`- [${e.id}｜第${e.round}轮｜${AGENT_LABEL[e.agent]}${d.roles[e.agent].name}] ${e.facts[0].text}`));
  lines.push("");
  lines.push(`## 六、十六个观察点（系统考察的具体行为）`);
  d.slots.forEach((s) => {
    const dim = dimensions.find((x) => x.id === s.dimension_id)!;
    lines.push(`- [${s.display_code}｜${s.dimension_id} ${dim.name}｜${AGENT_LABEL[s.target_agent]}] 观察点：${s.observation} ｜ 追问：${s.probe_intent}`);
  });
  lines.push("");
  lines.push(`## 七、八维权重（重要性与计分权重）`);
  lines.push(`- 权重模式：${weights.mode === "equal" ? "等权（未单独设置）" : weights.mode === "importance" ? "按重要程度评级" : weights.mode === "numeric" ? "按专业权重数值" : "按语言描述映射"}`);
  DIMENSION_IDS.forEach((id) => {
    const dim = dimensions.find((x) => x.id === id)!;
    const importance = weights.importance?.[id];
    const percent = (weights.weights[id] * 100).toFixed(1);
    const freeText = weights.free_text?.[id];
    lines.push(`- [${id} ${dim.name}] 重要程度：${importance ? `${importance}/5` : "未单独评级"} ｜ 权重：${percent}%${freeText ? ` ｜ 备注：${freeText}` : ""}`);
  });
  lines.push(`- 计分说明：${weights.note ?? "等权计分。"}`);
  lines.push("");
  lines.push(`## 八、修改意见（可选）`);
  lines.push(`（在这里写下你的修改要求；上传后系统会按意见调整场景。留空表示没有额外意见。）`);
  lines.push("");
  const filename = `场景配置_${d.title}_${d.assessment_version}.md`.replace(/[\\/:*?"<>|]/g, "_");
  return { markdown: lines.join("\n"), filename };
}

export interface ParsedScenarioDocument {
  title?: string;
  user_role?: string;
  publicFacts: Record<string, string>;
  roleFacts: Record<string, string>;
  events: Record<string, string>;
  slots: Record<string, { observation?: string; probe_intent?: string }>;
  weights: {
    importance?: Record<string, number>;
    freeText: Record<string, string>;
  };
  instruction: string;
  matched: { facts: number; slots: number; weights: number };
}

function section(text: string, start: number | undefined): string {
  if (start === undefined || start < 0) return "";
  const rest = text.slice(start);
  const next = rest.indexOf("\n## ");
  return next === -1 ? rest : rest.slice(0, next);
}

/** 解析回传文档。只提取能匹配到的字段，未匹配或格式破坏的条目保持原样（不破坏场景）。 */
export function parseScenarioDocument(markdown: string): ParsedScenarioDocument {
  const result: ParsedScenarioDocument = {
    publicFacts: {},
    roleFacts: {},
    events: {},
    slots: {},
    weights: { freeText: {} },
    instruction: "",
    matched: { facts: 0, slots: 0, weights: 0 }
  };
  const headings = [...markdown.matchAll(/^## /gm)].map((m) => markdown.indexOf(m[0], m.index ?? 0));
  const slice = (keyword: string) => {
    const at = headings.findIndex((h) => markdown.slice(h, h + 60).includes(keyword));
    return at === -1 ? "" : section(markdown, headings[at]);
  };
  const basic = slice("一、基本信息");
  const titleMatch = basic.match(/[-•]\s*场景标题：(.+)/);
  if (titleMatch) result.title = titleMatch[1].trim();
  const roleMatch = basic.match(/[-•]\s*受测者角色：(.+)/);
  if (roleMatch) result.user_role = roleMatch[1].trim();

  // 公开事实：- [U1:F1] 文本
  for (const m of markdown.matchAll(/^[-•]\s*\[([A-Z]\d*:F\d+(?:-\d+)?)\]\s*(.+)$/gm)) {
    result.publicFacts[m[1]] = m[2].trim();
    result.matched.facts += 1;
  }
  // 角色私有事实：- [U1:R1] 文本
  for (const m of markdown.matchAll(/^[-•]\s*\[([A-Z]\d*:R\d+(?:-\d+)?)\]\s*(.+)$/gm)) {
    result.roleFacts[m[1]] = m[2].trim();
    result.matched.facts += 1;
  }
  // 中途事件：- [U1:limit｜第3轮｜上级陈总] 文本
  for (const m of markdown.matchAll(/^[-•]\s*\[([A-Z]\d*:(?:limit|change))[｜|][^\]]*\]\s*(.+)$/gm)) {
    result.events[m[1]] = m[2].trim();
    result.matched.facts += 1;
  }
  // 观察点行：- [U1-01｜GE01 领导与决策｜上级] 观察点：… ｜ 追问：…
  for (const m of markdown.matchAll(/^[-•]\s*\[([A-Z]\d*-\d{2})[｜|]([A-Z]{2}\d{2})[^｜|]*[｜|]([^\]]+)\]\s*观察点：(.+?)(?:\s*[｜|]\s*追问：(.+))?$/gm)) {
    result.slots[m[1]] = { observation: m[4]?.trim(), probe_intent: m[5]?.trim() };
    result.matched.slots += 1;
  }
  // 权重行：- [GE01 领导与决策] 重要程度：5/5 ｜ 权重：20.0% ｜ 备注：…
  for (const m of markdown.matchAll(/^[-•]\s*\[(GE\d{2})[^\]]*\]\s*重要程度：(\d)\/5(?:\s*[｜|]\s*权重：[\d.]+%)?(?:\s*[｜|]\s*备注：(.+))?$/gm)) {
    const id = m[1];
    const level = Number(m[2]);
    if (level >= 1 && level <= 5) {
      result.weights.importance = result.weights.importance ?? {};
      result.weights.importance[id] = level;
    }
    if (m[3]?.trim()) result.weights.freeText[id] = m[3].trim();
    result.matched.weights += 1;
  }
  const instructionMatch = markdown.match(/##\s*八、修改意见[^\n]*\n([\s\S]*?)(?:\n##\s|$)/);
  if (instructionMatch) {
    const instruction = instructionMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !/^（.*）$/.test(line))
      .join("\n")
      .trim();
    result.instruction = instruction;
  }
  return result;
}

/** 把解析结果套用到定义内容上（只覆盖匹配到的内容字段，ID结构不动）。 */
export function applyParsedDocument(d: Definition, parsed: ParsedScenarioDocument): { definition: Definition; changed: string[] } {
  const next = structuredClone(d) as Definition;
  const changed: string[] = [];
  if (parsed.title && parsed.title !== next.title) {
    next.title = parsed.title.slice(0, 40);
    changed.push("标题");
  }
  if (parsed.user_role && parsed.user_role !== next.user_role) {
    next.user_role = parsed.user_role.slice(0, 40);
    changed.push("受测者角色");
  }
  let factChanges = 0;
  next.public_facts.forEach((f) => {
    const text = parsed.publicFacts[f.id];
    if (text && text !== f.text) { f.text = text; factChanges += 1; }
  });
  (["leader", "coworker", "client"] as const).forEach((agent) => {
    next.role_facts[agent].forEach((f) => {
      const text = parsed.roleFacts[f.id];
      if (text && text !== f.text) { f.text = text; factChanges += 1; }
    });
  });
  next.events.forEach((e) => {
    e.facts.forEach((f) => {
      const text = parsed.events[e.id];
      if (text && text !== f.text) { f.text = text; factChanges += 1; }
    });
  });
  if (factChanges) changed.push(`事实/事件 ${factChanges} 处`);
  let slotChanges = 0;
  next.slots.forEach((s) => {
    const patch = parsed.slots[s.display_code];
    if (!patch) return;
    if (patch.observation && patch.observation !== s.observation) { s.observation = patch.observation; slotChanges += 1; }
    if (patch.probe_intent && patch.probe_intent !== s.probe_intent) { s.probe_intent = patch.probe_intent; slotChanges += 1; }
  });
  if (slotChanges) changed.push(`观察点 ${slotChanges} 处`);
  return { definition: next, changed };
}
