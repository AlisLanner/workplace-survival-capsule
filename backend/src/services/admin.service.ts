import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma";
import { VERSION } from "../assessment/definitions";
import { legacyScenario } from "../assessment/legacy";
import { frozenScenario } from "../assessment/runtime";
import {
  assembleDefinition,
  customScenarioConfig,
  generateScenarioParts,
  isCustomVersion,
  newCustomVersion,
  resolveBriefWeights,
  validateCustomDefinition,
  type ScenarioBrief,
  type ScenarioParts
} from "../assessment/customScenario";
import { applyParsedDocument, parseScenarioDocument, renderScenarioDocument } from "../assessment/scenarioDoc";
import { DIMENSION_IDS, equalWeights, isEqualWeights, validateWeights, type DimensionWeights } from "../assessment/weights";
import type { Definition } from "../assessment/types";
import {
  normalizeDiscussion,
  normalizeScenario,
  normalizeSession,
  normalizeTraceEvent,
  parseJsonField,
  stringifyJson
} from "../utils/jsonField";

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

export async function getDashboardData() {
  const [totalSessions, completedSessions, runningSessions, finishedSessions] = await Promise.all([
    prisma.assessmentSession.count(),
    prisma.assessmentSession.count({ where: { status: "finished" } }),
    prisma.assessmentSession.count({ where: { status: "running" } }),
    prisma.assessmentSession.findMany({
      where: { status: "finished" },
      select: { totalScore: true, reportJson: true, scenarioId:true, assessmentVersion:true }
    })
  ]);

  const grouped = new Map<string,{scenario_id:string;assessment_version:string;model_config:string;count:number;total:number;dimensions:Record<string,number[]>}>();
  for(const session of finishedSessions) {
    const report=parseJsonField<any>(session.reportJson,null);
    if(session.totalScore===null || report?.mock_generated || report?.report_status!=="confident")continue;
    const model=JSON.stringify(report?.assessment_meta?.model??"legacy");
    const key=JSON.stringify([session.scenarioId,session.assessmentVersion??"legacy",model]);
    const group=grouped.get(key)??{scenario_id:session.scenarioId,assessment_version:session.assessmentVersion??"legacy",model_config:model,count:0,total:0,dimensions:{}};
    group.count++;group.total+=session.totalScore;
    for(const [name,value]of Object.entries(report.dimension_scores??{}))if(typeof value==="number")(group.dimensions[name]??=[]).push(value);
    grouped.set(key,group);
  }
  return {total_sessions:totalSessions,completed_sessions:completedSessions,running_sessions:runningSessions,average_score:null,average_dimension_scores:{},groups:[...grouped.values()].map(g=>({scenario_id:g.scenario_id,assessment_version:g.assessment_version,model_config:g.model_config,count:g.count,average_score:Number((g.total/g.count).toFixed(1)),average_dimension_scores:Object.fromEntries(Object.entries(g.dimensions).map(([k,v])=>[k,average(v)]))}))};

}

export async function listScenarios() {
  const scenarios = await prisma.scenario.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { sessions: true } } }
  });
  return scenarios.map(({ _count, ...scenario }) => ({
    ...normalizeScenario(scenario),
    origin: scenario.origin ?? (scenario.assessmentVersion ? "builtin" : "legacy"),
    sessionCount: _count.sessions,
    dimensionWeights: parseJsonField<DimensionWeights | null>(scenario.dimensionWeightsJson, null) ?? equalWeights(),
    weightsCustomized: !isEqualWeights(parseJsonField<DimensionWeights | null>(scenario.dimensionWeightsJson, null))
  }));
}

export async function updateScenario(id: string, data: Record<string, unknown>) {
  const current = await prisma.scenario.findUnique({ where: { id } });
  if (!current) throw new Error("Scenario not found");
  const custom = isCustomVersion(current.assessmentVersion);
  // 内置正式情境（已验证的测量工具）任务内容冻结，只能停用/启用或调权重；自定义情境可改展示信息。
  if (current.assessmentVersion && !custom && Object.keys(data).some((k) => !["status"].includes(k))) {
    throw new Error("内置正式情境的任务内容已冻结（保证测量口径一致）；如需不同任务请用“新建场景”生成自定义情境，或仅调整状态与维度权重。");
  }
  const allowed: Record<string, unknown> = {
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : undefined,
    description: typeof data.description === "string" ? data.description : undefined,
    backgroundForUser: typeof data.backgroundForUser === "string" ? data.backgroundForUser : undefined,
    maxRound: data.maxRound === undefined ? undefined : Math.min(15, Math.max(8, Math.round(Number(data.maxRound)))),
    groupChatEnabled: typeof data.groupChatEnabled === "boolean" ? data.groupChatEnabled : undefined,
    groupChatRounds: data.groupChatRounds === undefined ? undefined : stringifyJson(data.groupChatRounds),
    status: data.status
  };
  const patch = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));

  if (custom) {
    const definition = parseJsonField<Definition | null>(current.assessmentDefinitionJson, null);
    if (definition) {
      const nextDefinition = structuredClone(definition);
      if (patch.title) nextDefinition.title = String(patch.title).slice(0, 40);
      if (patch.maxRound !== undefined) nextDefinition.round_policy.max = Number(patch.maxRound);
      validateCustomDefinition(nextDefinition);
      patch.assessmentDefinitionJson = JSON.stringify(nextDefinition);
    }
  }

  const scenario = await prisma.scenario.update({ where: { id }, data: patch });
  return normalizeScenario(scenario);
}

export async function listPrompts() {
  return prisma.promptTemplate.findMany({
    orderBy: [{ key: "asc" }, { version: "desc" }]
  });
}

export async function updatePrompt(key: string, data: { content?: string; name?: string; active?: boolean }) {
  const current = await prisma.promptTemplate.findUnique({ where: { key } });
  if (!current) {
    throw new Error("Prompt template not found");
  }

  if(key.startsWith("ge8-")) {
    const version=key.split("/")[0];
    if(data.active===false)throw new Error("版本模板不能停用；请发布新修订。");
    if(!data.content?.trim())throw new Error("新版模板正文不能为空");
    return prisma.$transaction(async tx=>{
      const bundle=await tx.promptBundle.findFirst({where:{active:true,id:{startsWith:version+"/"}},orderBy:{createdAt:"desc"}});
      if(!bundle)throw new Error("当前模板包不存在");
      const keys=JSON.parse(bundle.keysJson) as Record<string,string>;const name=Object.keys(keys).find(n=>keys[n]===key);
      if(!name)throw new Error("正在编辑旧修订，请刷新后编辑当前模板");
      const revisions=await tx.promptBundle.count({where:{id:{startsWith:version+"/"}}});
      const id=`${version}/r${String(revisions+1).padStart(2,"0")}`;const newKey=`${id}/${name}`;
      const created=await tx.promptTemplate.create({data:{key:newKey,name:data.name??current.name,content:data.content!,version:current.version+1}});
      await tx.promptBundle.update({where:{id:bundle.id},data:{active:false}});
      await tx.promptBundle.create({data:{id,keysJson:JSON.stringify({...keys,[name]:newKey})}});return created;
    });
  }

  return prisma.promptTemplate.update({
    where: { key },
    data: {
      name: data.name ?? current.name,
      content: data.content ?? current.content,
      active: data.active ?? current.active,
      version: { increment: data.content && data.content !== current.content ? 1 : 0 }
    }
  });
}

const ABANDONED_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function listSessions() {
  const sessions = await prisma.assessmentSession.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      user: true,
      scenario: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } }
    }
  });

  // Auto-abandon sessions that are "running" with no activity for > 30 minutes
  const now = Date.now();
  const abandonedIds: string[] = [];

  for (const session of sessions) {
    if (session.status !== "running" || session.turnLockId) continue;
    const lastActivity =
      session.messages.length > 0
        ? new Date(session.messages[0].createdAt).getTime()
        : new Date(session.startedAt).getTime();
    if (now - lastActivity > ABANDONED_TIMEOUT_MS) {
      abandonedIds.push(session.id);
    }
  }

  if (abandonedIds.length > 0) {
    await prisma.assessmentSession.updateMany({
      where: { id: { in: abandonedIds } },
      data: { status: "abandoned", endedAt: new Date() }
    });
  }

  return Promise.all(sessions.map(async(session) => ({
    ...normalizeSession(session),
    status: abandonedIds.includes(session.id) ? "abandoned" : session.status,
    scenario: normalizeScenario(session.assessmentVersion?frozenScenario(session.scenario,session.assessmentSnapshotJson):await legacyScenario(session.scenario))
  })));
}

export async function getSessionDetail(sessionId: string) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
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
  session.scenario=session.assessmentVersion?frozenScenario(session.scenario,session.assessmentSnapshotJson):await legacyScenario(session.scenario);

  return {
    session: {
      ...normalizedSession,
      scenario: normalizeScenario(session.scenario)
    },
    messages: session.messages,
    group_discussions: session.groupDiscussions.map(normalizeDiscussion),
    agent_trace: session.agentTraceEvents.map(normalizeTraceEvent),
    report: normalizedSession.reportJson,
    assessment_audit: session.assessmentVersion ? {
      snapshot:parseJsonField(session.assessmentSnapshotJson, null),
      state:parseJsonField(session.blackboardState, {}),
      scoring_run_id:session.scoringRunId,scoring_attempts:session.scoringAttempts,
      calls:await prisma.assessmentCallAudit.findMany({where:{sessionId},orderBy:{createdAt:"asc"}})
    } : null
  };
}

// ── 面向使用者（公司/HR/用人部门）的场景自助配置 ─────────────────────

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function clampRound(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(15, Math.max(8, n)) : fallback;
}

function normalizeBrief(body: Record<string, unknown>): ScenarioBrief {
  const text = (key: string, max = 2000): string | undefined => {
    const value = body[key];
    return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
  };
  const title = text("title", 40);
  const userRole = text("user_role", 40);
  const desc = text("scenario_desc", 4000);
  if (!title || title.length < 2) throw new Error("请填写场景标题（至少2个字）");
  if (!userRole || userRole.length < 2) throw new Error("请填写受测者角色/岗位（至少2个字）");
  if (!desc || desc.length < 10) throw new Error("请描述情境内容（至少10个字）：时间、任务、矛盾和压力点");
  const rolesInput = body.roles as Record<string, Record<string, unknown>> | undefined;
  const roles: ScenarioBrief["roles"] = {};
  for (const agent of ["leader", "coworker", "client"] as const) {
    const r = rolesInput?.[agent];
    if (r && typeof r === "object") {
      roles[agent] = {
        name: typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 12) : undefined,
        hint: typeof r.hint === "string" && r.hint.trim() ? r.hint.trim().slice(0, 200) : undefined
      };
    }
  }
  return {
    title,
    industry: text("industry", 200),
    user_role: userRole,
    scenario_desc: desc,
    job_requirements: text("job_requirements", 2000),
    focus_dimensions: Array.isArray(body.focus_dimensions) ? body.focus_dimensions.map(String).slice(0, 8) : undefined,
    roles,
    extra_notes: text("extra_notes", 2000),
    max_round: clampRound(body.max_round, 12)
  };
}

async function activeGe8BundleKeys(): Promise<Record<string, string>> {
  const bundle = await prisma.promptBundle.findFirst({
    where: { active: true, id: { startsWith: `${VERSION}/` } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
  if (!bundle) {
    const { ge8BundleKeys } = await import("../assessment/customScenario");
    return ge8BundleKeys();
  }
  return JSON.parse(bundle.keysJson) as Record<string, string>;
}

async function nextCustomCode(): Promise<string> {
  const customs = await prisma.scenario.findMany({ where: { origin: "custom" }, select: { assessmentDefinitionJson: true } });
  let max = 0;
  for (const row of customs) {
    const code = parseJsonField<{ scenario_code?: string } | null>(row.assessmentDefinitionJson, null)?.scenario_code;
    const match = code?.match(/^U(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `U${max + 1}`;
}

export async function createSimpleScenario(data: Record<string, unknown>) {
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (title.length < 2) throw new Error("请填写场景标题");
  const scenario = await prisma.scenario.create({
    data: {
      id: `simple-${randomHex(4)}`,
      title: title.slice(0, 40),
      description: typeof data.description === "string" && data.description.trim() ? data.description.trim() : "自定义 · 旧版演示流程",
      backgroundForUser: typeof data.backgroundForUser === "string" && data.backgroundForUser.trim() ? data.backgroundForUser.trim() : "（待补充任务背景）",
      maxRound: clampRound(data.maxRound, 8),
      groupChatEnabled: typeof data.groupChatEnabled === "boolean" ? data.groupChatEnabled : true,
      groupChatRounds: stringifyJson([3, 6]),
      status: "active"
    }
  });
  return { ...normalizeScenario(scenario), origin: "legacy-simple", sessionCount: 0 };
}

/** 向导主入口：按使用者的简报生成统一八维自定义情境并安装。 */
export async function generateScenarioFromBrief(body: Record<string, unknown>) {
  const brief = normalizeBrief(body);
  const weights = await resolveBriefWeights(body.weights_input ?? { mode: "equal" });
  validateWeights(weights);
  const generation = await generateScenarioParts(brief);
  const version = newCustomVersion();
  const code = await nextCustomCode();
  const scenarioId = `custom-${randomHex(4)}`;
  const definition = assembleDefinition(partsWithFocus(generation.parts, brief), {
    scenarioId,
    scenarioCode: code,
    version,
    weights,
    maxRound: brief.max_round
  });
  const keys = await activeGe8BundleKeys();
  const config = customScenarioConfig(definition, weights, brief);
  const scenario = await prisma.scenario.create({ data: { id: scenarioId, ...config } });
  await prisma.promptBundle.create({ data: { id: `${version}/r01`, keysJson: JSON.stringify(keys) } });
  return {
    scenario: { ...normalizeScenario(scenario), origin: "custom", sessionCount: 0 },
    definition,
    weights,
    generated_by: generation.generated_by,
    attempts: generation.attempts,
    warnings: generation.warnings
  };
}

/** 重点考察维度写入公开事实的机会提示，不改变评分标准。 */
function partsWithFocus(parts: ScenarioParts, brief: ScenarioBrief): ScenarioParts {
  if (!brief.focus_dimensions?.length) return parts;
  const focus = brief.focus_dimensions.join("、");
  return {
    ...parts,
    public_facts: [...parts.public_facts, `本情境特别关注以下能力的真实表现机会：${focus}。任务与评分标准不变。`]
  };
}

export async function getScenarioDetail(id: string) {
  const scenario = await prisma.scenario.findUnique({ where: { id }, include: { _count: { select: { sessions: true } } } });
  if (!scenario) throw new Error("Scenario not found");
  const { _count, ...row } = scenario;
  return {
    scenario: {
      ...normalizeScenario(row),
      origin: row.origin ?? (row.assessmentVersion ? "builtin" : "legacy"),
      sessionCount: _count.sessions
    },
    definition: parseJsonField<Definition | null>(row.assessmentDefinitionJson, null),
    weights: parseJsonField<DimensionWeights | null>(row.dimensionWeightsJson, null) ?? equalWeights(),
    brief: parseJsonField<ScenarioBrief | null>(row.briefJson, null)
  };
}

export async function updateScenarioWeights(id: string, body: Record<string, unknown>) {
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) throw new Error("Scenario not found");
  const weights = await resolveBriefWeights(body);
  validateWeights(weights);
  const updated = await prisma.scenario.update({ where: { id }, data: { dimensionWeightsJson: JSON.stringify(weights) } });
  return {
    scenario: normalizeScenario(updated),
    weights,
    note: scenario.assessmentVersion
      ? "权重已保存；从下一次测评会话开始生效（进行中的会话沿用开始时的快照）。"
      : "权重已保存。注意：该场景仍是旧版演示流程，报告暂不参与八维加权计分。"
  };
}

export async function deleteScenario(id: string) {
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) throw new Error("Scenario not found");
  const count = await prisma.assessmentSession.count({ where: { scenarioId: id } });
  if (count > 0) {
    throw new Error(`该场景已有 ${count} 个测评会话记录，为保留历史数据不能删除。可将其停用：把状态改为 inactive，候选人端将不再显示。`);
  }
  await prisma.scenario.delete({ where: { id } });
  return { deleted: id };
}

function partsFromDefinition(d: Definition): ScenarioParts {
  const findEvent = (suffix: string) => d.events.find((e) => e.id.endsWith(suffix)) ?? d.events[0];
  const limit = findEvent(":limit");
  const change = findEvent(":change");
  return {
    title: d.title,
    user_role: d.user_role,
    roles: structuredClone(d.roles),
    public_facts: d.public_facts.map((f) => f.text),
    role_facts: {
      leader: d.role_facts.leader.map((f) => f.text),
      coworker: d.role_facts.coworker.map((f) => f.text),
      client: d.role_facts.client.map((f) => f.text)
    },
    events: {
      limit: { agent: limit.agent, round: limit.round, text: limit.facts[0]?.text ?? "" },
      change: { agent: change.agent, round: change.round, text: change.facts[0]?.text ?? "" }
    },
    slots: Object.fromEntries(
      (["GE01", "GE02", "GE03", "GE04", "GE05", "GE06", "GE07", "GE08"] as const).map((dimId) => [
        dimId,
        d.slots.filter((s) => s.dimension_id === dimId).map((s) => ({ observation: s.observation, probe_intent: s.probe_intent, target_agent: s.target_agent }))
      ])
    ) as ScenarioParts["slots"],
    anchors: Object.fromEntries(
      d.anchors.map((a) => [a.dimension_id, { low: a.low, middle: a.middle, high: a.high, missing: a.missing }])
    ) as ScenarioParts["anchors"]
  };
}

/** 修订自定义场景：支持系统内修改意见与文档回传两种入口。 */
export async function reviseScenario(id: string, body: { instruction?: unknown; markdown?: unknown }) {
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) throw new Error("Scenario not found");
  if (!isCustomVersion(scenario.assessmentVersion)) {
    throw new Error("只有“新建场景”生成的自定义情境支持修订；内置正式情境的任务内容已冻结，可在详情页调整维度权重。");
  }
  const running = await prisma.assessmentSession.count({ where: { scenarioId: id, status: { in: ["running", "scoring"] } } });
  if (running > 0) throw new Error(`该场景有 ${running} 个进行中的会话；请等其结束后再修订，避免同一场测评中途换口径。`);
  const currentDef = parseJsonField<Definition | null>(scenario.assessmentDefinitionJson, null);
  if (!currentDef) throw new Error("自定义定义缺失，无法修订；请删除后重新生成");
  let parts = partsFromDefinition(currentDef);
  let instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  let docChanged: string[] = [];
  let weights: DimensionWeights = parseJsonField<DimensionWeights | null>(scenario.dimensionWeightsJson, null) ?? equalWeights();
  if (typeof body.markdown === "string" && body.markdown.trim()) {
    const parsed = parseScenarioDocument(body.markdown);
    if (parsed.title && parsed.title !== currentDef.title) docChanged.push("标题");
    const applied = applyParsedDocument(currentDef, parsed);
    if (applied.changed.length) {
      parts = partsFromDefinition(applied.definition);
      docChanged = [...new Set([...docChanged, ...applied.changed])];
    }
    if (parsed.instruction) instruction = `${instruction}\n${parsed.instruction}`.trim();
    if (parsed.weights.importance && Object.keys(parsed.weights.importance).length === 8) {
      const { weightsFromImportance } = await import("../assessment/weights");
      weights = weightsFromImportance(parsed.weights.importance, "由回传文档中的重要程度评级更新。");
    }
    if (parsed.weights.freeText && Object.keys(parsed.weights.freeText).length) {
      const emptyText = Object.fromEntries(DIMENSION_IDS.map((dimId) => [dimId, ""])) as Record<(typeof DIMENSION_IDS)[number], string>;
      weights = { ...weights, mode: "free_text", free_text: { ...(weights.free_text ?? emptyText), ...parsed.weights.freeText } };
    }
  }
  if (!instruction && !docChanged.length) throw new Error("没有检测到修改内容：请填写修改意见，或在文档中调整后重新上传。");
  const brief = parseJsonField<ScenarioBrief | null>(scenario.briefJson, null);
  const generation = instruction
    ? await generateScenarioParts(brief ?? { title: currentDef.title, user_role: currentDef.user_role, scenario_desc: currentDef.public_facts.map((f) => f.text).join("；") }, { parts, instruction })
    : { parts, generated_by: "document" as const, attempts: 1, warnings: [] as string[] };
  const version = newCustomVersion();
  const definition = assembleDefinition(generation.parts, {
    scenarioId: scenario.id,
    scenarioCode: currentDef.scenario_code,
    version,
    weights,
    maxRound: currentDef.round_policy.max
  });
  const keys = await activeGe8BundleKeys();
  const config = customScenarioConfig(definition, weights, brief ?? { title: definition.title, user_role: definition.user_role, scenario_desc: instruction });
  const updated = await prisma.scenario.update({ where: { id }, data: config });
  await prisma.promptBundle.create({ data: { id: `${version}/r01`, keysJson: JSON.stringify(keys) } });
  return {
    scenario: { ...normalizeScenario(updated), origin: "custom" },
    definition,
    weights,
    generated_by: generation.generated_by,
    applied: { document_changes: docChanged, instruction: instruction || "(仅文档字段修改)" }
  };
}

export async function exportScenarioDocument(id: string) {
  const scenario = await prisma.scenario.findUnique({ where: { id }, include: { _count: { select: { sessions: true } } } });
  if (!scenario) throw new Error("Scenario not found");
  if (!scenario.assessmentVersion || !scenario.assessmentDefinitionJson) {
    throw new Error("旧版演示场景没有统一八维定义，暂不支持文档导出。");
  }
  const definition = parseJsonField<Definition | null>(scenario.assessmentDefinitionJson, null);
  if (!definition) throw new Error("场景定义缺失，无法导出文档");
  const weights = parseJsonField<DimensionWeights | null>(scenario.dimensionWeightsJson, null) ?? equalWeights();
  const { _count, ...row } = scenario;
  return renderScenarioDocument({ scenario: row, definition, weights, sessionCount: _count.sessions });
}

export async function importScenarioDocument(id: string, markdown: string) {
  if (typeof markdown !== "string" || !markdown.trim()) throw new Error("请粘贴或上传文档内容");
  return reviseScenario(id, { markdown });
}
