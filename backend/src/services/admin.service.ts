import { prisma } from "../db/prisma";
import { VERSION } from "../assessment/definitions";
import { legacyScenario } from "../assessment/legacy";
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
    orderBy: { createdAt: "asc" }
  });
  return scenarios.map(normalizeScenario);
}

export async function updateScenario(id: string, data: Record<string, unknown>) {
  const current=await prisma.scenario.findUnique({where:{id}});
  if(current?.assessmentVersion && Object.keys(data).some(k=>!["status"].includes(k)))throw new Error("新版任务内容已冻结；须创建并安装新测量版本后再修改。现有会话不受影响。");
  const allowed = {
    title: data.title,
    description: data.description,
    backgroundForUser: data.backgroundForUser,
    maxRound: data.maxRound,
    groupChatEnabled: data.groupChatEnabled,
    groupChatRounds: data.groupChatRounds === undefined ? undefined : stringifyJson(data.groupChatRounds),
    status: data.status
  };

  const scenario = await prisma.scenario.update({
    where: { id },
    data: Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined))
  });

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
    if (session.status !== "running") continue;
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
    scenario: normalizeScenario(session.assessmentVersion?session.scenario:await legacyScenario(session.scenario))
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
  if(!session.assessmentVersion)session.scenario=await legacyScenario(session.scenario);

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
