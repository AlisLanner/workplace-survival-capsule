import { randomUUID } from "node:crypto";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { prisma } from "../db/prisma";
import { evaluateResponseQuality, isTimeExpiredSignal } from "../services/responseQuality.service";
import type { StreamingTurnEvents } from "../services/orchestrator.service";
import { canonicalReply, director, guard, npc } from "./agents";
import { coverage, delivered, initialState, nextProbe, publicState, recordEvidence } from "./coverage";
import { getDefinition, hash, SCHEMA } from "./definitions";
import { judge } from "./judge";
import { createSnapshot, readSnapshot } from "./runtime";
import type { Definition, Ge8Report, Ge8State, Snapshot, TranscriptMessage } from "./types";
import { normalizeScenario, normalizeTraceEvent } from "../utils/jsonField";
import { callContext } from "./audit";

export async function startGe8(scenarioId:string,input:{user_id?:string;nickname?:string}) {
  return prisma.$transaction(async tx=>{
    const scenario=await tx.scenario.findUniqueOrThrow({where:{id:scenarioId}});
    if(scenario.status!=="active" || !scenario.assessmentVersion)throw new Error("测评情境未启用新版");
    getDefinition(scenario.id,scenario.assessmentVersion); // Reject unknown versions; never infer A.
    const d=JSON.parse(scenario.assessmentDefinitionJson??"null") as Definition;
    if(!d || d.scenario_id!==scenario.id || d.assessment_version!==scenario.assessmentVersion || hash(d)!==hash(getDefinition(scenario.id,scenario.assessmentVersion)))throw new Error("已安装定义与版本不匹配，请核对安装记录");
    const snapshot=await createSnapshot(tx,d);const state=initialState(snapshot.definition);
    let userId=input.user_id;
    if(userId)await tx.user.upsert({where:{id:userId},create:{id:userId,nickname:input.nickname},update:input.nickname?{nickname:input.nickname}:{}});
    else if(input.nickname)userId=(await tx.user.create({data:{nickname:input.nickname}})).id;
    const openingSlots=d.slots.filter(s=>s.target_agent==="leader").slice(0,2);
    const probe={agent:"leader" as const,slot_ids:openingSlots.map(s=>s.slot_id),questions:openingSlots.map(s=>s.probe_intent),facts:[...d.public_facts,...d.role_facts.leader],event_ids:[]};
    const opening=canonicalReply(snapshot,probe);
    const session=await tx.assessmentSession.create({data:{scenarioId,userId,assessmentVersion:d.assessment_version,assessmentSnapshotJson:JSON.stringify(snapshot),blackboardState:JSON.stringify(state)}});
    const message=await tx.message.create({data:{sessionId:session.id,senderType:"agent",senderName:opening.speaker,senderRole:opening.role,content:opening.content,roundIndex:0}});
    delivered(probe,message.id,0,state,d);state.pending_probe=probe;
    await tx.assessmentSession.update({where:{id:session.id},data:{blackboardState:JSON.stringify(state)}});
    return {session_id:session.id,opening_message:opening,blackboard:publicState(state),scenario:normalizeScenario(scenario)};
  });
}

async function claimScoring(id:string) {
  const run=`${process.pid}:${randomUUID()}`;
  const result=await prisma.assessmentSession.updateMany({where:{id,status:"running",scoringRunId:null},data:{status:"scoring",scoringRunId:run,scoringAttempts:{increment:1}}});
  if(!result.count)throw new Error("评分任务已被占用，不会重复启动Judge");
  return run;
}
async function saveReport(id:string,run:string,report:Ge8Report,state:Ge8State) {
  const changed=await prisma.assessmentSession.updateMany({where:{id,status:"scoring",scoringRunId:run},data:{status:"finished",reportJson:JSON.stringify(report),totalScore:report.report_status==="confident"&&!report.mock_generated?report.total_score:null,endedAt:new Date(),blackboardState:JSON.stringify(state),turnLockId:null,turnLockedAt:null}});
  if(!changed.count)throw new Error("评分任务已变更，未覆盖报告");
}
export async function runGe8(id:string,content:string,events?:StreamingTurnEvents):Promise<any> {
  const session=await prisma.assessmentSession.findUniqueOrThrow({where:{id},include:{messages:{orderBy:[{roundIndex:"asc"},{createdAt:"asc"}]},scenario:true}});
  const snapshot=readSnapshot(session.assessmentSnapshotJson);const d=snapshot.definition;
  let state=JSON.parse(session.blackboardState) as Ge8State;
  if(state.schema_version!==SCHEMA || state.scenario_id!==d.scenario_id || state.assessment_version!==d.assessment_version)throw new Error("会话状态与冻结定义不一致");
  if(session.status!=="running")return {finished:session.status==="finished",reply:{speaker:"测评系统",role:"系统",content:session.status==="finished"?"本次测评已结束。":"评分任务进行中或已中断，请在后台查看状态。"},round:session.round,phase:session.status,report:session.reportJson?JSON.parse(session.reportJson):undefined,blackboard:publicState(state)};
  const lock=randomUUID();const claimed=await prisma.assessmentSession.updateMany({where:{id,status:"running",turnLockId:null},data:{turnLockId:lock,turnLockedAt:new Date()}});
  if(!claimed.count)throw new Error("本轮正在处理，重复请求未执行");
  const messages:TranscriptMessage[]=[...session.messages];let report:Ge8Report|undefined;
  let reply={speaker:"测评系统",role:"系统",content:"本次情境取证结束。"};
  let finish=false;let expired=false;let directorFinish=false;const traces:any[]=[];
  let suggestion:{agent:string;slot_ids:string[]}|undefined;
  const trace=async(node:string,status:"running"|"completed"|"failed",summary:string)=>{
    const e=await prisma.agentTraceEvent.create({data:{sessionId:id,runId:lock,nodeId:node,agentName:node,eventType:"node",status,summary,sequence:traces.length+1}});
    const safe=normalizeTraceEvent(e);traces.push(safe);events?.onAgentTrace?.(safe as any);
  };
  const node=(name:string,work:()=>Promise<void>)=>async(t:{step:number})=>{await trace(name,"running",`${name}开始`);try{await work();await trace(name,"completed",`${name}完成`);}catch(e){await trace(name,"failed",`${name}失败，未伪造评分或候选人行为`);throw e;}return {step:t.step+1};};
  const ann=Annotation.Root({step:Annotation<number>()});
  try {
    const graph=new StateGraph(ann)
      .addNode("responseQualityGate",node("responseQualityGate",async()=>{
        expired=evaluateResponseQuality(session.messages,content).shouldTerminate;
        state.round=session.round+1;
        const m=await prisma.$transaction(async tx=>{
          const m=await tx.message.create({data:{sessionId:id,senderType:expired?"system":"user",senderName:expired?"计时系统":"候选人",content,roundIndex:state.round}});
          await tx.assessmentSession.update({where:{id},data:{round:state.round,blackboardState:JSON.stringify(state)}});return m;
        });messages.push(m);
      }))
      .addNode("director",node("director",async()=>{
        if(expired){finish=true;return;}
        const result=await director(snapshot,state,nextProbe(d,state),messages);
        const errors=recordEvidence(result.slot_evidence,d,state,messages);if(errors.length)throw new Error(errors.join("；"));
        directorFinish=result.should_finish;
        suggestion=result.next_probe;
        finish=state.round>=state.max_round || (state.round>=state.min_round && directorFinish && coverage(d,state).complete);
      }))
      .addNode("groupGuard",node("groupGuard",async()=>{
        if(finish)return;const probe=nextProbe(d,state,suggestion);state.pending_probe=probe;
        if(session.scenario.groupChatEnabled && (probe.event_ids.length || JSON.parse(session.scenario.groupChatRounds).includes(state.round))) {
          const result=await guard(snapshot,state,probe,messages);
          await prisma.agentGroupDiscussion.create({data:{sessionId:id,roundIndex:state.round,phase:state.phase,inputJson:JSON.stringify({probe,assessment_version:d.assessment_version}),outputJson:JSON.stringify(result)}});
          // Guard has no write access to facts, definition, evidence, or score. Canonical probe is retained.
        }
      }))
      .addNode("npc",node("npc",async()=>{
        if(finish)return;const probe=state.pending_probe!;
        try{reply=await npc(snapshot,state,probe,messages);}catch{await trace("npcSafeProbe","completed","角色技术失败，使用冻结中性问题；未降级为模拟评分");reply=canonicalReply(snapshot,probe);}
        const m=await prisma.message.create({data:{sessionId:id,senderType:"agent",senderName:reply.speaker,senderRole:reply.role,content:reply.content,roundIndex:state.round}});messages.push(m);
        delivered(probe,m.id,state.round,state,d);
        events?.onSpeaker(reply.speaker,reply.role);for(let i=0;i<reply.content.length;i+=12)events?.onToken(reply.content.slice(i,i+12));
      }))
      .addNode("persistTurn",node("persistTurn",async()=>{
        await prisma.assessmentSession.update({where:{id},data:{round:state.round,blackboardState:JSON.stringify(state)}});
      }))
      .addNode("judge",node("judge",async()=>{
        if(!finish)return;const run=await claimScoring(id);state.phase="finished";
        events?.onJudging?.();
        report=await judge(snapshot,state,messages,n=>events?.onReportProgress?.({stage:"judge_sampling",current:n,total:5,percent:10+n*15,message:`已完成${n}/5路评分`}));
        await saveReport(id,run,report,state);
        events?.onReportProgress?.({stage:"done",percent:100,message:"报告已保存"});
      }))
      .addEdge(START,"responseQualityGate").addEdge("responseQualityGate","director").addEdge("director","groupGuard").addEdge("groupGuard","npc").addEdge("npc","persistTurn").addEdge("persistTurn","judge").addEdge("judge",END).compile({name:"Ge8AssessmentGraph"});
    await callContext.run({sessionId:id,runId:lock},()=>graph.invoke({step:0}));
    return {finished:finish,reply,round:state.round,phase:state.phase,report,blackboard:publicState(state),agent_trace:traces};
  } finally {
    await prisma.assessmentSession.updateMany({where:{id,turnLockId:lock,status:"running"},data:{turnLockId:null,turnLockedAt:null}});
  }
}

export async function retryScoring(id:string) {
  const s=await prisma.assessmentSession.findUniqueOrThrow({where:{id},include:{messages:{orderBy:[{roundIndex:"asc"},{createdAt:"asc"}]}}});
  if(!s.assessmentVersion || s.scoringAttempts>=2)throw new Error("重试上限已到，需人工复核");
  const oldReport=s.reportJson?JSON.parse(s.reportJson):null;
  if(s.status==="scoring") {
    const owner=Number(s.scoringRunId?.split(":")[0]);if(!owner)throw new Error("无法确认评分进程状态，停止重试");
    let alive=true;try{process.kill(owner,0);}catch(e){if((e as NodeJS.ErrnoException).code==="ESRCH")alive=false;}
    if(alive)throw new Error("原评分进程仍存在，不会重复调用");
  } else if(s.status!=="scoring_interrupted" && oldReport?.report_status!=="scoring_failed")throw new Error("此会话不允许重试评分");
  const run=`${process.pid}:${randomUUID()}`;
  const changed=await prisma.assessmentSession.updateMany({where:{id,status:s.status,scoringRunId:s.scoringRunId,scoringAttempts:s.scoringAttempts},data:{status:"scoring",scoringRunId:run,scoringAttempts:{increment:1}}});
  if(!changed.count)throw new Error("评分任务已被占用");
  const snapshot=readSnapshot(s.assessmentSnapshotJson);const state=JSON.parse(s.blackboardState) as Ge8State;state.phase="finished";
  const report=await callContext.run({sessionId:id,runId:run},()=>judge(snapshot,state,s.messages));await saveReport(id,run,report,state);return report;
}
