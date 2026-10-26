import { randomBytes } from "node:crypto";
import { callDeepSeek } from "../services/llm.service";
import { strictJson } from "./strictJson";
import { BUNDLE, dimensions, PROMPT_NAMES, SCHEMA } from "./definitions";
import { DIMENSION_IDS, heuristicImportance, parseWeightsInput, validateWeights, weightsFromFreeText, type DimensionWeights } from "./weights";
import type { AgentName } from "../types/agent";
import type { Definition, DimensionId, Fact, Slot } from "./types";

/**
 * 使用者（公司/HR/用人部门）自助生成统一八维自定义情境。
 *
 * 生成策略：大模型只负责"内容"（事实、角色、观察点话术、锚例说明），
 * 全部结构性字段（slot_id、fact_id、事件、版本、量规、轮次策略）由代码组装，
 * 从构造上保证定义满足运行契约（validateCustomDefinition 再做终检）。
 * 离线 mock 模式使用模板拼装，保证全链路可离线验证。
 */

export type CustomAgentName = AgentName; // leader | coworker | client
const AGENTS: CustomAgentName[] = ["leader", "coworker", "client"];
const AGENT_LABEL: Record<CustomAgentName, string> = { leader: "上级", coworker: "同级协作方", client: "利益相关方" };

export interface ScenarioBrief {
  title: string;
  industry?: string;
  user_role: string;
  scenario_desc: string;
  job_requirements?: string;
  focus_dimensions?: string[];
  weights_input?: Record<string, unknown>;
  roles?: Partial<Record<CustomAgentName, { name?: string; hint?: string }>>;
  extra_notes?: string;
  max_round?: number;
}

export interface ScenarioParts {
  title: string;
  user_role: string;
  roles: Record<CustomAgentName, { name: string; role: string }>;
  public_facts: string[];
  role_facts: Record<CustomAgentName, string[]>;
  events: {
    limit: { agent: CustomAgentName; round: number; text: string };
    change: { agent: CustomAgentName; round: number; text: string };
  };
  slots: Record<DimensionId, Array<{ observation: string; probe_intent: string; target_agent: CustomAgentName }>>;
  anchors: Record<DimensionId, { low: string; middle: string; high: string; missing: string }>;
}

const STANDARD_BANDS = [
  "0—5：必要信息和机会充分，仍明确回避行动或有直接不当行为；引用原话。",
  "6—10：有相关态度或零散动作，但关键依据、责任、条件或执行细节不足。",
  "11—15：主要判断动作基本适用，能说明依据与安排，但观察到重要缺口或衔接不足。",
  "16—20：两个点均有充分证据，判断、行动与边界一致，符合本岗位权限与条件。"
];
const STANDARD_BOUNDARIES = [
  "合作看尊重、支持和共同承担；沟通看信息组织与协商。",
  "比较已知方案归分析；新的适用思路和吸收信息后的改进归创造。",
  "决策看选择和担责；执行看安排和跟踪。新人不评管理授权。",
  "既定交付归执行；额外目标的价值与投入判断归进取。",
  "稳定条件计划归执行；实际变化后的调整和质疑回应归适应。",
  "诚信主要归合作，权限程序主要归执行；同一风险不全维重复扣分。"
];

export function isCustomVersion(version: string | null | undefined): boolean {
  return typeof version === "string" && version.startsWith("custom-");
}

export function newCustomVersion(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `custom-${ymd}-${randomBytes(3).toString("hex")}`;
}

function clampRounds(max: number): number[] {
  const capped = Math.min(15, Math.max(8, Math.round(max || 12)));
  const rounds = [3, Math.min(6, capped - 1)].filter((r, i, arr) => r < capped && arr.indexOf(r) === i);
  return rounds.length ? rounds : [3];
}

/** 把内容件组装为满足运行契约的完整定义；结构性 ID 全部在此生成。 */
export function assembleDefinition(parts: ScenarioParts, ctx: { scenarioId: string; scenarioCode: string; version: string; weights?: DimensionWeights; maxRound?: number }): Definition {
  const code = ctx.scenarioCode;
  const maxRound = Math.min(15, Math.max(8, Math.round(ctx.maxRound || 12)));
  const sanitizeAgent = (agent: CustomAgentName | undefined, fallback: CustomAgentName): CustomAgentName =>
    agent && AGENTS.includes(agent) ? agent : fallback;
  const publicFacts: Fact[] = parts.public_facts.map((text, i) => ({ id: `${code}:F${i + 1}`, text }));
  const roleFacts = Object.fromEntries(
    AGENTS.map((agent, i) => [agent, (parts.role_facts[agent] ?? []).map((text, n) => ({ id: `${code}:R${i + 1}${n > 0 ? `-${n + 1}` : ""}`, text }))])
  ) as Definition["role_facts"];
  const events: Definition["events"] = [
    { id: `${code}:limit`, round: Math.max(1, Math.min(maxRound - 2, parts.events.limit.round || 3)), agent: parts.events.limit.agent, facts: [{ id: `${code}:L1`, text: parts.events.limit.text }] },
    { id: `${code}:change`, round: Math.max(2, Math.min(maxRound - 1, parts.events.change.round || 5)), agent: parts.events.change.agent, facts: [{ id: `${code}:X1`, text: parts.events.change.text }] }
  ];
  const slots: Slot[] = [];
  let index = 0;
  for (const dim of dimensions) {
    const provided = parts.slots[dim.id] ?? [];
    const pair = [0, 1].map((k) => {
      const item = provided[k];
      return {
        observation: (item?.observation ?? "").trim() || TEMPLATE_SLOTS[dim.id][k].observation,
        probe_intent: (item?.probe_intent ?? "").trim() || TEMPLATE_SLOTS[dim.id][k].probe_intent,
        target_agent: sanitizeAgent(item?.target_agent, k === 0 ? "leader" : "coworker")
      };
    });
    // 最后一道防线：同维两点文案相同时替换为另一侧面，保证16点两两可区分。
    if (pair[0].observation === pair[1].observation || pair[0].probe_intent === pair[1].probe_intent) {
      const alt = pair[1].observation === TEMPLATE_SLOTS[dim.id][1].observation ? TEMPLATE_SLOTS[dim.id][0] : TEMPLATE_SLOTS[dim.id][1];
      pair[1] = { observation: alt.observation, probe_intent: alt.probe_intent, target_agent: pair[1].target_agent };
    }
    for (const slotContent of pair) {
      index += 1;
      const targetAgent = slotContent.target_agent;
      const required = publicFacts.map((f) => f.id);
      const triggers: string[] = [];
      if (index === 10) {
        required.push(`${code}:L1`);
        triggers.push(`${code}:limit`);
      }
      if (index === 13) {
        required.push(`${code}:X1`);
        triggers.push(`${code}:change`);
      }
      if (index === 14 && roleFacts[targetAgent].length) {
        required.push(roleFacts[targetAgent][0].id);
      }
      slots.push({
        slot_id: `${ctx.version}:${String(index).padStart(2, "0")}`,
        display_code: `${code}-${String(index).padStart(2, "0")}`,
        dimension_id: dim.id,
        observation: slotContent.observation,
        target_agent: targetAgent,
        probe_intent: slotContent.probe_intent,
        required_fact_ids: required,
        trigger_event_ids: triggers,
        priority: [8, 9, 12, 13, 14, 15].includes(index) ? 2 : 1
      });
    }
  }
  const anchors = dimensions.map((dim) => {
    const a = parts.anchors[dim.id] ?? ({} as Partial<ScenarioParts["anchors"][DimensionId]>);
    return {
      dimension_id: dim.id,
      low: a.low ?? `0—5：必要信息和机会已提供时，在${dim.name}方面明确回避行动、推卸责任或出现直接不当行为；须引用原话。`,
      middle: a.middle ?? `6—10：在${dim.name}方面有相关态度或零散动作，但关键依据、责任或执行细节不足。11—15：主要动作基本适用，能说明依据，但存在衔接缺口。`,
      high: a.high ?? `16—20：在${dim.name}方面判断、行动与边界一致，能结合任务条件说明理由并担责；不是唯一正确答案。`,
      missing: a.missing ?? `必要事实未送达、没有真实回应机会或技术失败时保留null，不以0分代替缺失。`
    };
  });
  const d: Definition = {
    assessment_version: ctx.version,
    schema_version: SCHEMA,
    scenario_id: ctx.scenarioId,
    scenario_code: code,
    title: parts.title,
    user_role: parts.user_role,
    dimensions,
    roles: parts.roles,
    slots,
    public_facts: publicFacts,
    role_facts: roleFacts,
    events,
    round_policy: { min: 8, max: maxRound, max_consecutive_agent_rounds: 2 },
    scoring_policy: { samples: 5, total_variance_limit: 80, dimension_range_limit: 8, bands: STANDARD_BANDS, boundaries: STANDARD_BOUNDARIES, evidence_policy: "response-quality/1" },
    anchors,
    prompt_bundle_version: `${ctx.version}/r01`,
    dimension_weights: ctx.weights
  };
  validateCustomDefinition(d);
  return d;
}

/** 自定义定义终检：结构与运行契约一致才允许入库。 */
export function validateCustomDefinition(d: Definition): void {
  const problems: string[] = [];
  const roleFactsOf = (agent: CustomAgentName) => (Array.isArray(d.role_facts?.[agent]) ? d.role_facts[agent] : []);
  if (!isCustomVersion(d.assessment_version)) problems.push("自定义定义的版本号必须以 custom- 开头");
  if (d.schema_version !== SCHEMA) problems.push("schema_version 不受支持");
  if (!d.scenario_id || !d.title?.trim() || !d.user_role?.trim()) problems.push("缺少场景ID、标题或受测者角色");
  if (!/^[A-Z][0-9]{0,3}$/.test(d.scenario_code ?? "")) problems.push("scenario_code 格式无效");
  if ((d.dimensions?.length ?? 0) !== 8 || d.dimensions.some((dim, i) => dim.id !== dimensions[i]?.id || dim.name !== dimensions[i]?.name)) problems.push("八维ID或名称与统一八维注册表不一致");
  for (const agent of AGENTS) {
    const role = d.roles?.[agent];
    if (!role?.name?.trim() || !role?.role?.trim()) problems.push(`角色 ${agent} 缺少名字或定位`);
  }
  if (!Array.isArray(d.public_facts) || d.public_facts.length < 3 || d.public_facts.some((f) => !f.text?.trim())) problems.push("公开事实至少3条且不能为空");
  for (const agent of AGENTS) {
    if (roleFactsOf(agent).length < 1 || roleFactsOf(agent).some((f) => !f.text?.trim())) problems.push(`角色 ${agent} 至少需要1条私有事实`);
  }
  const factIds = new Set<string>([
    ...d.public_facts.map((f) => f.id),
    ...AGENTS.flatMap((a) => roleFactsOf(a).map((f) => f.id)),
    ...(d.events ?? []).flatMap((e) => e.facts.map((f) => f.id))
  ]);
  const eventIds = new Set((d.events ?? []).map((e) => e.id));
  if ((d.events?.length ?? 0) !== 2) problems.push("必须恰好包含2个中途事件（限制与变化）");
  const seenSlots = new Set<string>(), seenCodes = new Set<string>();
  let maxEventRound = 0;
  (d.events ?? []).forEach((e) => {
    if (!e.id || !e.facts.every((f) => f.id && f.text?.trim())) problems.push(`事件 ${e.id || "?"} 的事实缺少ID或内容`);
    if (!AGENTS.includes(e.agent)) problems.push(`事件 ${e.id} 的角色无效`);
    if (!Number.isInteger(e.round) || e.round < 1 || e.round >= d.round_policy?.max) problems.push(`事件 ${e.id} 轮次须在 1—${(d.round_policy?.max ?? 12) - 1} 之间`);
    maxEventRound = Math.max(maxEventRound, e.round);
  });
  if ((d.slots?.length ?? 0) !== 16) problems.push("必须恰好16个观察点");
  (d.slots ?? []).forEach((slot, i) => {
    const expectedDim = dimensions[Math.floor(i / 2)]?.id;
    if (slot.dimension_id !== expectedDim) problems.push(`观察点 ${slot.slot_id} 顺序错乱（第${i + 1}个应属于 ${expectedDim}）`);
    if (!slot.slot_id?.startsWith(`${d.assessment_version}:`)) problems.push(`观察点 ${slot.slot_id} 的ID前缀与版本不一致`);
    if (seenSlots.has(slot.slot_id)) problems.push(`观察点ID重复：${slot.slot_id}`);
    seenSlots.add(slot.slot_id);
    if (!slot.display_code?.trim() || seenCodes.has(slot.display_code)) problems.push(`观察点代码缺失或重复：${slot.display_code}`);
    seenCodes.add(slot.display_code);
    if (!slot.observation?.trim() || slot.observation.trim().length < 6) problems.push(`观察点 ${slot.display_code} 内容过短`);
    if (!slot.probe_intent?.trim()) problems.push(`观察点 ${slot.display_code} 缺少中性追问`);
    if (!AGENTS.includes(slot.target_agent)) problems.push(`观察点 ${slot.display_code} 目标角色无效`);
    if ((slot.required_fact_ids ?? []).some((f) => !factIds.has(f))) problems.push(`观察点 ${slot.display_code} 引用了不存在的事实`);
    if ((slot.trigger_event_ids ?? []).some((e) => !eventIds.has(e))) problems.push(`观察点 ${slot.display_code} 引用了不存在的事件`);
  });
  for (const dim of dimensions) {
    if ((d.slots ?? []).filter((s) => s.dimension_id === dim.id).length !== 2) problems.push(`${dim.name} 必须2个观察点`);
    const anchor = (d.anchors ?? []).find((a) => a.dimension_id === dim.id);
    if (!anchor || !anchor.low?.trim() || !anchor.middle?.trim() || !anchor.high?.trim() || !anchor.missing?.trim()) problems.push(`${dim.name} 的评分锚例不完整`);
  }
  if ((d.anchors?.length ?? 0) !== 8) problems.push("评分锚例必须恰好8条");
  if ((d.round_policy?.min ?? 0) < 6 || (d.round_policy?.max ?? 0) > 15 || d.round_policy.min > d.round_policy.max) problems.push("轮次策略无效（最少6轮，最多15轮）");
  if (maxEventRound >= (d.round_policy?.max ?? 12)) problems.push("事件轮次超出对话轮次上限");
  if (d.scoring_policy?.evidence_policy !== "response-quality/1") problems.push("自定义场景必须沿用 response-quality/1 证据策略");
  if (!d.prompt_bundle_version?.startsWith(`${d.assessment_version}/`)) problems.push("prompt_bundle_version 与版本不匹配");
  if (d.dimension_weights) {
    try { validateWeights(d.dimension_weights); } catch (error) { problems.push(error instanceof Error ? error.message : "权重配置无效"); }
  }
  if (problems.length) throw new Error(`自定义场景定义未通过校验：\n${problems.join("\n")}`);
}

// ── 大模型生成（真实模式）与模板生成（离线模式） ─────────────────────

const GENERATE_SYSTEM_PROMPT = `你是资深人才测评命题专家，为"统一八维"职场情境测验编写情境内容。八维是：
GE01 领导与决策：在职责范围内作出选择、发起行动并担责；有管理职责时还观察指导与授权。
GE02 支持与合作：理解并尊重他人，提供支持、共同处理问题；如实说明情况并遵守诚信原则。
GE03 互动与呈现：针对沟通对象组织信息、说明理由、协商分歧，使对方能够理解并作出回应。
GE04 分析与解释：区分事实、未知与假设，核验关键依据，分析原因、影响和不同选择的后果。
GE05 创造与概念化：学习并吸收新信息，提出有针对性的新思路或改进机制，解释其如何解决问题。
GE06 组织与执行：把目标转为优先级、责任、时间与检查安排，遵循已知程序并保障交付质量。
GE07 适应与应对：关键条件变化后调整做法，受到催促、批评或挫折时仍能回应问题并推进任务。
GE08 进取与绩效：提出与职责相称的工作提升目标，权衡业务价值、投入与成本；说明为何值得争取。

写作要求：
1. 公开事实4条：含时间与任务、权限边界、资源与成本约束、基本目标与可选增值目标；须具体可核验（时间、数量、金额、权限上限）。
2. 三名角色各1条私有事实：只该角色知道的立场或约束，会自然影响对话。
3. 两个中途事件：limit是资源或权限收紧（第3轮左右），change是条件变化（第5轮左右），由指定角色说出。
4. 每维2个观察点共16点：观察点是可观察的行为描述（不是品质名词），同维两点覆盖不同侧面；中性追问是不诱导答案的开放问题。
5. 情境必须给全部八维真实表现机会（特质激活）；重点考察维度可安排更多机会，但不改变评分标准。
6. 评分锚例按维度写清0—5、6—10/11—15、16—20的反向/中间/充分表现样例说明，missing说明何种情况保留null不补0。
7. 不出现歧视、违法、骚扰内容；不设置唯一正确答案；受测者角色与目标岗位层级一致。
只输出一个完整JSON对象，不输出其他文字，字段结构严格遵守用户给出的模板。`;

function generationUserPrompt(brief: ScenarioBrief, previous?: { parts: ScenarioParts; instruction: string }): string {
  const schema = `{
  "title": "场景标题(简短)",
  "user_role": "受测者角色(含岗位层级)",
  "roles": {"leader": {"name": "上级名字", "role": "上级身份与关注点"}, "coworker": {"name": "同级名字", "role": "同级身份与处境"}, "client": {"name": "利益相关方名字", "role": "身份与诉求"}},
  "public_facts": ["公开事实1", "公开事实2", "公开事实3", "公开事实4"],
  "role_facts": {"leader": ["上级私有事实"], "coworker": ["同级私有事实"], "client": ["利益相关方私有事实"]},
  "events": {"limit": {"agent": "leader|coworker|client", "round": 3, "text": "限制收紧事件内容"}, "change": {"agent": "leader|coworker|client", "round": 5, "text": "条件变化事件内容"}},
  "slots": {"GE01": [{"observation": "观察点行为描述", "probe_intent": "中性追问", "target_agent": "leader|coworker|client"}, {"observation": "...", "probe_intent": "...", "target_agent": "..."}], "GE02": [同上两个], "GE03": [...], "GE04": [...], "GE05": [...], "GE06": [...], "GE07": [...], "GE08": [...]},
  "anchors": {"GE01": {"low": "...", "middle": "...", "high": "...", "missing": "..."}, "GE02": {...}, "GE03": {...}, "GE04": {...}, "GE05": {...}, "GE06": {...}, "GE07": {...}, "GE08": {...}}
}`;
  const lines: string[] = [];
  if (previous) {
    lines.push(`现有情境内容如下（JSON）：\n${JSON.stringify(previous.parts, null, 2)}`);
    lines.push(`使用者修改要求：${previous.instruction}`);
    lines.push("请按修改要求输出修订后的完整内容JSON，未涉及的部分保持原样。");
  } else {
    lines.push(`请为以下岗位与情境需求编写情境内容。`);
  }
  lines.push(`【输入信息】
- 场景标题：${brief.title}
- 行业/公司背景：${brief.industry ?? "未填写，请按常见企业情境合理设定"}
- 受测者角色：${brief.user_role}
- 情境描述：${brief.scenario_desc}
- 岗位要求：${brief.job_requirements ?? "未填写"}
- 重点考察维度：${(brief.focus_dimensions ?? []).join("、") || "未特别指定"}
- 角色补充设定：${JSON.stringify(brief.roles ?? {})}
- 其他要求：${brief.extra_notes ?? "无"}`);
  lines.push(`【输出JSON模板】（严格按此结构，只填内容，不要增删字段）\n${schema}`);
  return lines.join("\n\n");
}

function coerceParts(input: unknown, brief: ScenarioBrief): ScenarioParts {
  const x = input as Record<string, any>;
  const roleName = (agent: CustomAgentName, fallbackIdx: number) => {
    const given = brief.roles?.[agent]?.name?.trim();
    if (given) return given;
    const defaults = ["陈总", "李工", "王经理"];
    return String(x?.roles?.[agent]?.name ?? "").trim() || defaults[fallbackIdx];
  };
  const roles = Object.fromEntries(AGENTS.map((agent, i) => [
    agent,
    { name: roleName(agent, i), role: String(x?.roles?.[agent]?.role ?? "").trim() || `${AGENT_LABEL[agent]}（${brief.user_role}的对话对象）` }
  ])) as ScenarioParts["roles"];
  const dimName = (id: string) => dimensions.find((d) => d.id === id)?.name ?? id;
  const slots = Object.fromEntries(DIMENSION_IDS.map((id) => [id, (Array.isArray(x?.slots?.[id]) ? x.slots[id] : []).slice(0, 2).map((s: any) => ({
    observation: String(s?.observation ?? "").trim(),
    probe_intent: String(s?.probe_intent ?? "").trim(),
    target_agent: (AGENTS.includes(s?.target_agent) ? s.target_agent : "client") as CustomAgentName
  }))])) as ScenarioParts["slots"];
  const anchors = Object.fromEntries(DIMENSION_IDS.map((id) => [id, {
    low: String(x?.anchors?.[id]?.low ?? "").trim(),
    middle: String(x?.anchors?.[id]?.middle ?? "").trim(),
    high: String(x?.anchors?.[id]?.high ?? "").trim(),
    missing: String(x?.anchors?.[id]?.missing ?? "").trim()
  }])) as ScenarioParts["anchors"];
  return {
    title: String(x?.title ?? brief.title).trim().slice(0, 40) || brief.title,
    user_role: String(x?.user_role ?? brief.user_role).trim().slice(0, 40) || brief.user_role,
    roles,
    public_facts: (Array.isArray(x?.public_facts) ? x.public_facts : []).map((t: unknown) => String(t ?? "").trim()).filter(Boolean).slice(0, 6),
    role_facts: Object.fromEntries(AGENTS.map((agent) => [
      agent,
      (Array.isArray(x?.role_facts?.[agent]) ? x.role_facts[agent] : []).map((t: unknown) => String(t ?? "").trim()).filter(Boolean).slice(0, 2)
    ])) as ScenarioParts["role_facts"],
    events: {
      limit: {
        agent: (AGENTS.includes(x?.events?.limit?.agent) ? x.events.limit.agent : "client") as CustomAgentName,
        round: Number(x?.events?.limit?.round) || 3,
        text: String(x?.events?.limit?.text ?? "").trim()
      },
      change: {
        agent: (AGENTS.includes(x?.events?.change?.agent) ? x.events.change.agent : "client") as CustomAgentName,
        round: Number(x?.events?.change?.round) || 5,
        text: String(x?.events?.change?.text ?? "").trim()
      }
    },
    slots,
    anchors
  };
}

/**
 * 每维两个观察点的兜底模板：同维两点关注该维度的不同侧面（参照内置正式情境的写法，
 * 如A情境组织与执行的"拆分范围/负责人/检查节点"与"交付标准/所需工作/超权限确认"）。
 * 大模型输出缺失或同维两点重复时按此补齐/替换，保证16点两两可区分。
 */
const TEMPLATE_SLOTS: Record<DimensionId, Array<{ observation: string; probe_intent: string }>> = {
  GE01: [
    { observation: "在职责权限内就关键事项作出明确取舍，说明选择理由并承担相应责任", probe_intent: "这件事里哪些是你职责内可以直接决定的？你会怎么定，理由是什么？" },
    { observation: "推进受阻时主动发起行动或调整分工，带动他人继续完成任务", probe_intent: "如果第一步推进不下去，你会主动做些什么来推动？必要时怎么分工？" }
  ],
  GE02: [
    { observation: "关注对话对象的实际处境并提供力所能及的支持，共同处理问题", probe_intent: "对方现在最需要你配合的是什么？你能提供哪些支持，边界在哪里？" },
    { observation: "如实说明已知情况、自身局限或差错，不夸大、不隐瞒", probe_intent: "目前有哪些信息你还不掌握或不确定？你会如何向相关方说明？" }
  ],
  GE03: [
    { observation: "按沟通对象组织信息、说明理由，使对方能够理解并作出回应", probe_intent: "你会如何向对方说明这件事的来龙去脉和你的考虑？" },
    { observation: "出现分歧或质疑时就事论事协商，回应对方关切并寻找可行方案", probe_intent: "如果对方不认可你的安排，你会怎么和他沟通？" }
  ],
  GE04: [
    { observation: "区分已确认事实、未知事项与个人假设，核验关键依据", probe_intent: "目前哪些是已确认的事实，哪些还只是猜测或待核验？你会怎么核实？" },
    { observation: "分析问题原因、影响范围和不同选择的后果", probe_intent: "不同处理方式各会带来什么后果？你更看重哪一方面？" }
  ],
  GE05: [
    { observation: "吸收新信息后修正原有判断或做法，说明调整依据", probe_intent: "新收到的信息与原计划有出入时，你会怎么调整？为什么？" },
    { observation: "提出有针对性的新思路或改进机制，并说明它如何解决问题", probe_intent: "有没有比现有做法更好的办法？它为什么可行？" }
  ],
  GE06: [
    { observation: "明确工作范围、负责人、时间安排与检查节点", probe_intent: "这件事你会怎么拆分？每部分谁负责、什么时候检查？" },
    { observation: "说明交付标准与所需支持，以及超出权限时的确认流程", probe_intent: "做到什么程度算完成？超出你权限的部分需要谁来确认？" }
  ],
  GE07: [
    { observation: "关键条件变化后及时调整原有安排，并说明调整依据", probe_intent: "如果中途情况有变，你会先调整什么？怎么判断调整是否合理？" },
    { observation: "受到催促、批评或挫折时仍回应问题、保持任务推进", probe_intent: "如果被连续催促或质疑，你会如何应对并保持推进？" }
  ],
  GE08: [
    { observation: "提出与职责相称的改进目标或值得争取的结果", probe_intent: "在完成基本任务之外，你认为还有什么值得争取或改进的？" },
    { observation: "权衡业务价值、投入与成本，说明为什么值得做", probe_intent: "这些额外投入的价值和成本怎么权衡？为什么值得？" }
  ]
};

function fillTemplateGaps(parts: ScenarioParts, brief: ScenarioBrief): ScenarioParts {
  const scenario = brief.scenario_desc?.trim() || brief.title;
  const filled: ScenarioParts = {
    ...parts,
    title: parts.title || brief.title,
    user_role: parts.user_role || brief.user_role,
    public_facts: parts.public_facts.length >= 3 ? parts.public_facts : [
      ...parts.public_facts,
      ...[
        `任务背景：${scenario}`,
        `你是${parts.user_role || brief.user_role}，可以决定本人工作、提出建议并请求协作；重大变更须与上级确认。`,
        `可用资源有限，额外投入需要说明成本与收益，由你权衡是否值得争取。`,
        `基本目标是稳妥完成当前任务；在条件允许时可以争取更好的结果。`
      ]
    ].slice(0, 6),
    role_facts: Object.fromEntries(AGENTS.map((agent, i) => [
      agent,
      parts.role_facts[agent].length ? parts.role_facts[agent] : [`${AGENT_LABEL[agent]}${parts.roles[agent].name}另有自己的立场与约束，会在对话中自然表达；相关细节需要你来询问和确认。`]
    ])) as ScenarioParts["role_facts"],
    events: {
      limit: {
        ...parts.events.limit,
        text: parts.events.limit.text || `${parts.roles[parts.events.limit.agent].name}补充：现有资源或权限比预期更紧，需要你在既定条件下完成。`
      },
      change: {
        ...parts.events.change,
        text: parts.events.change.text || `${parts.roles[parts.events.change.agent].name}通知：情况有新变化，原计划的前提需要重新核对。`
      }
    },
    slots: Object.fromEntries(DIMENSION_IDS.map((id) => {
      const provided = parts.slots[id];
      const facets = TEMPLATE_SLOTS[id];
      const dim = dimensions.find((d) => d.id === id)!;
      // 旧版模板残留（"面对任务推进中的具体阻碍，…"或整段照抄维度定义）视为缺失，升级为分侧面模板。
      const isLegacyFallback = (text: string) => !text.trim() || text.startsWith("面对任务推进中的具体阻碍") || text.includes(dim.meaning);
      const base = [0, 1].map((k) => {
        const item = provided[k];
        return {
          observation: isLegacyFallback(item?.observation ?? "") ? facets[k].observation : item!.observation.trim(),
          probe_intent: (item?.probe_intent ?? "").trim() || facets[k].probe_intent,
          target_agent: item?.target_agent ?? (k === 0 ? ("leader" as const) : ("coworker" as const))
        };
      });
      // 同维两点观察点或追问完全相同时，第二点换用另一侧面的模板，保证16点两两可区分。
      if (base[0].observation === base[1].observation || base[0].probe_intent === base[1].probe_intent) {
        const alt = base[1].observation === facets[1].observation ? facets[0] : facets[1];
        base[1] = { observation: alt.observation, probe_intent: alt.probe_intent, target_agent: base[1].target_agent };
      }
      return [id, base];
    })) as ScenarioParts["slots"],
    anchors: Object.fromEntries(DIMENSION_IDS.map((id) => {
      const a = parts.anchors[id];
      const dim = dimensions.find((d) => d.id === id)!;
      return [id, {
        low: a.low || `0—5：必要信息和机会已提供时，在${dim.name}方面明确回避、推责或直接不当；须引用原话。`,
        middle: a.middle || `6—10：有相关态度或零散动作但关键依据不足；11—15：主要动作基本适用但存在缺口。`,
        high: a.high || `16—20：判断、行动与边界一致，符合岗位权限与条件；不是唯一正确答案。`,
        missing: a.missing || `必要事实未送达、无回应机会或技术失败时保留null，不以0分代替缺失。`
      }];
    })) as ScenarioParts["anchors"]
  };
  // 焦点维度提示不改变结构；返回前兜底公开事实数量
  if (filled.public_facts.length < 3) filled.public_facts.push(`本情境用于考察${brief.user_role}在压力下的判断与行动。`);
  return filled;
}

/** 离线模板生成：不调用大模型，保证全链路可离线验证与测试。 */
export function templateParts(brief: ScenarioBrief): ScenarioParts {
  return fillTemplateGaps(coerceParts({}, brief), brief);
}

export interface GenerationResult {
  parts: ScenarioParts;
  definition: Definition;
  generated_by: "model" | "template";
  attempts: number;
  warnings: string[];
}

/** 生成自定义情境定义：真实模式调用大模型（带修复重试），mock 模式模板拼装。 */
export async function generateScenarioParts(brief: ScenarioBrief, previous?: { parts: ScenarioParts; instruction: string }): Promise<{ parts: ScenarioParts; generated_by: "model" | "template"; attempts: number; warnings: string[] }> {
  const warnings: string[] = [];
  const mockMode = process.env.USE_MOCK_LLM === "true";
  if (mockMode || !process.env.DEEPSEEK_API_KEY) {
    if (!mockMode) warnings.push("未配置API key，使用模板生成；连接真实模型后可重新生成。");
    // 离线修订同样经过模板补齐与去重，保证观察点两两可区分。
    const parts = previous ? fillTemplateGaps(applyInstructionToParts(previous.parts, previous.instruction), brief) : templateParts(brief);
    return { parts, generated_by: "template", attempts: 1, warnings };
  }
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await callDeepSeek({
        systemPrompt: GENERATE_SYSTEM_PROMPT,
        userPrompt: generationUserPrompt(brief, previous),
        temperature: 0.45,
        maxTokens: 14000,
        jsonMode: true,
        thinking: false,
        timeoutMs: 240000,
        allowMockFallback: false,
        maxAttempts: 1
      });
      const parts = fillTemplateGaps(coerceParts(strictJson(raw), brief), brief);
      return { parts, generated_by: "model", attempts: attempt, warnings };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`大模型生成失败（已重试3次）：${lastError}。可改用模板生成或稍后重试。`);
}

/** 离线模式下按修改意见做确定性调整：仅处理标题与显式替换，其余记录待真实模式处理。 */
export function applyInstructionToParts(parts: ScenarioParts, instruction: string): ScenarioParts {
  const next = structuredClone(parts);
  const titleMatch = instruction.match(/标题[改为：:]{1,3}[「"']?([^」"'\n。；;]{2,40})/);
  if (titleMatch) next.title = titleMatch[1].trim();
  const roleMatch = instruction.match(/(?:受测者|候选人)角色[改为：:]{1,3}[「"']?([^」"'\n。；;]{2,30})/);
  if (roleMatch) next.user_role = roleMatch[1].trim();
  return next;
}

/** 大白话重要性 → 1—5 评级。真实模式用大模型映射，离线用关键词规则。 */
export async function mapFreeTextImportance(freeText: Record<string, string>): Promise<{ importance: Record<DimensionId, number>; by: "model" | "heuristic"; reasons?: Record<string, string> }> {
  const keys = DIMENSION_IDS;
  const heuristic = () => Object.fromEntries(keys.map((id) => [id, heuristicImportance(freeText[id] ?? "")])) as Record<DimensionId, number>;
  if (process.env.USE_MOCK_LLM === "true" || !process.env.DEEPSEEK_API_KEY) {
    return { importance: heuristic(), by: "heuristic" };
  }
  try {
    const raw = await callDeepSeek({
      systemPrompt: `你是岗位分析专家。把使用者对八个胜任力维度重要性的大白话描述映射为1—5的重要程度评级（1=几乎不需要，2=次要，3=一般，4=很重要，5=至关重要/岗位核心）。只依据描述的语气与措辞判断，描述为空或没有明确倾向时给3。只输出JSON：{"GE01":1-5,...,"GE08":1-5,"reasons":{"GE01":"一句话理由",...}}。`,
      userPrompt: JSON.stringify(Object.fromEntries(keys.map((id) => [id, freeText[id] ?? ""])), null, 2),
      temperature: 0.1,
      maxTokens: 2000,
      jsonMode: true,
      thinking: false,
      timeoutMs: 90000,
      allowMockFallback: false,
      maxAttempts: 1
    });
    const parsed = strictJson(raw) as Record<string, unknown>;
    const importance = Object.fromEntries(keys.map((id) => {
      const value = Number(parsed[id]);
      return [id, Number.isInteger(value) && value >= 1 && value <= 5 ? value : 3];
    })) as Record<DimensionId, number>;
    const reasons = parsed.reasons && typeof parsed.reasons === "object" ? Object.fromEntries(keys.map((id) => [id, String((parsed.reasons as Record<string, unknown>)[id] ?? "")])) : undefined;
    return { importance, by: "model", reasons };
  } catch {
    return { importance: heuristic(), by: "heuristic" };
  }
}

/** 解析使用者的权重输入（含大白话→评级的大模型映射）。 */
export async function resolveBriefWeights(input: unknown): Promise<DimensionWeights> {
  const body = (input ?? {}) as Record<string, unknown>;
  if (body.mode === "free_text") {
    const freeText = (body.free_text ?? {}) as Record<string, string>;
    const mapped = await mapFreeTextImportance(freeText);
    const weights = weightsFromFreeText(freeText, mapped.importance,
      mapped.by === "model" ? "语言描述已由大模型映射为1—5重要程度后归一化。" : "离线模式：语言描述按关键词规则映射为1—5重要程度，连接真实模型后可重新映射。");
    if (mapped.reasons) weights.note = `${weights.note ?? ""} 逐维理由：${DIMENSION_IDS.map((id) => `${id} ${mapped.reasons![id] || "—"}`).join("；")}`;
    return weights;
  }
  return parseWeightsInput(body);
}

export function scenarioBackgroundForUser(d: Definition): string {
  return [`你是${d.user_role}。`, ...d.public_facts.map((f) => f.text), "这是模拟任务设定，请说明你的判断及理由。"].join("\n\n");
}

/** 组装场景入库配置（与内置安装的 definitionConfig 同构）。 */
export function customScenarioConfig(d: Definition, weights: DimensionWeights, brief: ScenarioBrief) {
  return {
    title: d.title,
    description: `${d.scenario_code} · 统一八维 · 自定义 · ${d.user_role}`,
    backgroundForUser: scenarioBackgroundForUser(d),
    assessmentVersion: d.assessment_version,
    assessmentDefinitionJson: JSON.stringify(d),
    maxRound: d.round_policy.max,
    groupChatRounds: JSON.stringify(clampRounds(d.round_policy.max)),
    origin: "custom" as const,
    briefJson: JSON.stringify(brief),
    dimensionWeightsJson: JSON.stringify(weights)
  };
}

/** 当前激活的 ge8 模板包键位，供自定义场景复用同一组提示词。 */
export function ge8BundleKeys(fallbackBundle = BUNDLE): Record<string, string> {
  return Object.fromEntries(PROMPT_NAMES.map((name) => [name, `${fallbackBundle}/${name}`]));
}
