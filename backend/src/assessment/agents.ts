import { callDeepSeek } from "../services/llm.service";
import { auditedCall } from "./audit";
import { findNpcBoundaryViolation } from "../utils/npcBoundaryGuard";
import { strictJson } from "./strictJson";
import { agentView, locateEvidence } from "./coverage";
import type { Evidence, Ge8State, Probe, Snapshot, TranscriptMessage } from "./types";
import { composeRoleSpeech, ownVoice, spokenFact } from "./roleSpeech";

async function jsonCall(s:Snapshot,key:string,kind:"director"|"npc"|"guard",input:unknown,check:(x:any)=>unknown):Promise<any> {
  const p=s.model[kind];let failure:unknown;
  for(let attempt=1;attempt<=s.model.max_attempts;attempt++) {
    const request=attempt===1?input:{...(input as Record<string,unknown>),repair:{validation_error:failure instanceof Error?failure.message.slice(0,400):"输出契约失败",instruction:"在相同事实和契约下重新输出完整合法JSON。不得补写候选人原话或行为；没有证据保留缺失。"}};
    try {return await auditedCall(key,{systemPrompt:s.prompts[key].content,userPrompt:JSON.stringify(request),model:s.model.fast_model,temperature:p.temperature,maxTokens:p.max_tokens,thinking:p.thinking,timeoutMs:p.timeout_ms,baseUrl:s.model.base_url,maxAttempts:1,allowMockFallback:false},raw=>check(strictJson(raw)));}
    catch(e){failure=e;}
  }
  throw failure;
}
export async function director(s:Snapshot,state:Ge8State,probe:Probe,messages:TranscriptMessage[]):Promise<{slot_evidence:Evidence[];should_finish:boolean;next_probe?:{agent:string;slot_ids:string[]}}> {
  if(s.model.mock) {
    const latest=messages.filter(m=>m.senderType==="user").at(-1);
    const evidence:Evidence[]=[];
    if(latest)for(const slot of s.definition.slots) {
      // Explicit synthetic fixture syntax; arbitrary prose is never keyword-scored by the mock.
      const marker=`【${slot.display_code}】`;const i=latest.content.indexOf(marker);
      if(i<0)continue;const start=i+marker.length;const end=latest.content.indexOf("【",start);const quote=latest.content.slice(start,end<0?undefined:end).trim();
      const e:Evidence={slot_id:slot.slot_id,message_id:latest.id,quote,sufficiency:"sufficient",valence:quote.startsWith("反例：")?"counter":"support",reason:"明确标记的合成回归样例；不用于正式评价。"};
      try{evidence.push(locateEvidence(e,s.definition,state,messages));}catch{}
    }
    return {slot_evidence:evidence,should_finish:true};
  }
  const incremental=s.model.director.evidence_scope==="latest_candidate";
  const latest=messages.filter(m=>m.senderType==="user").at(-1);
  const input=agentView("director",s.definition,state,probe,messages);
  const request=incremental?{...input,evidence_scope:"latest_candidate",latest_candidate_message_id:latest?.id??null,
    coverage:Object.fromEntries(Object.entries(state.slots).map(([id,slot])=>[id,{opportunities:slot.opportunities,sufficient:slot.evidence.some(e=>e.sufficiency==="sufficient"),partial:slot.evidence.some(e=>e.sufficiency==="partial")}]))}:input;
  return jsonCall(s,"director","director",request,x=>{
    if(!Array.isArray(x?.slot_evidence) || typeof x.should_finish!=="boolean")throw new Error("导演契约无效");
    if(incremental && (x.slot_evidence.length>16 || x.slot_evidence.some((e:Evidence)=>e?.sufficiency!=="none" && e?.message_id!==latest?.id)))throw new Error("只提取latest_candidate_message_id的新增证据，最多16点；历史证据已保留，不重复输出。");
    if(x.next_probe && (!["leader","coworker","client"].includes(x.next_probe.agent) || !Array.isArray(x.next_probe.slot_ids) || x.next_probe.slot_ids.some((id:string)=>!s.definition.slots.some(slot=>slot.slot_id===id && slot.target_agent===x.next_probe.agent))))throw new Error("导演调度了未知槽位或错误角色");
    const evidence=x.slot_evidence.filter((e:Evidence)=>{
      if(!e || !s.definition.slots.some(slot=>slot.slot_id===e.slot_id))throw new Error("未知证据槽位");
      // An explicit absence is not evidence and never satisfies coverage or becomes a zero score.
      return e.sufficiency!=="none";
    }).map((e:Evidence)=>locateEvidence(e,s.definition,state,messages));
    return {slot_evidence:evidence,should_finish:x.should_finish,next_probe:x.next_probe};
  });
}
export async function guard(s:Snapshot,state:Ge8State,probe:Probe,messages:TranscriptMessage[],draft?:unknown) {
  if(s.model.mock)return {no_change:true,issues:[]};
  return jsonCall(s,"group-discussion","guard",{...agentView("guard",s.definition,state,probe,messages),draft},x=>{
    if(typeof x?.no_change!=="boolean" || !Array.isArray(x.issues) || x.issues.some((v:unknown)=>typeof v!=="string" || !v.trim()) || x.no_change!==!x.issues.length)throw new Error("守护契约无效");
    return {no_change:x.no_change,issues:x.issues};
  });
}
export function canonicalReply(s:Snapshot,probe:Probe) {
  const p=s.definition.roles[probe.agent];
  const facts=probe.facts.map(f=>spokenFact(f.text,p.name,s.definition.public_facts.some(item=>item.id===f.id)));
  return {speaker:p.name,role:p.role,content:composeRoleSpeech(facts,probe.questions)};
}
export async function npc(s:Snapshot,state:Ge8State,probe:Probe,messages:TranscriptMessage[]) {
  const canonical=canonicalReply(s,probe);
  if(s.model.mock)return canonical;
  const requiredStatements=probe.facts.map(f=>spokenFact(f.text,canonical.speaker,s.definition.public_facts.some(item=>item.id===f.id)));
  const input={...agentView("npc",s.definition,state,probe,messages),speech_style:{perspective:"直接以角色第一人称和候选人对话，不要第三人称旁白或重复交代同一事件。",required_statements:requiredStatements,instruction:"将required_statements原文各整合一次，再提出probe中的中性问题；不得更改事实、权限、时间和不确定性。"}};
  const result=await jsonCall(s,probe.agent,"npc",input,x=>{
    const r=x?.visible_reply;
    if(r?.speaker!==canonical.speaker || r?.role!==canonical.role || typeof r.content!=="string" || !r.content.trim())throw new Error("角色身份或输出无效");
    if(/GE0[1-8]|评分|高分|低分|维度|满分|正确答案|过关|你应该|建议你/.test(r.content))throw new Error("角色回复泄露评分或替候选人作答");
    if(findNpcBoundaryViolation(probe.agent,r.content))throw new Error("角色回复超出中性探测边界");
    const allowedFacts=[...s.definition.public_facts,...Object.values(s.definition.role_facts).flat().filter(f=>state.released_facts[f.id]),...s.definition.role_facts[probe.agent],...probe.facts].map(f=>f.text).join(" ");
    const numbers=r.content.match(/\d+(?:\.\d+)?/g)??[];
    if(numbers.some((n:string)=>!allowedFacts.includes(n)))throw new Error("角色编造了未获准的数值");
    // Deliver every fact in its deterministic spoken form before marking its ID released.
    // Drop verbatim narrator lines if a model echoes the raw probe instead of its speech projection.
    const draft=ownVoice(r.content.split("\n").filter((line:string)=>!probe.facts.some(f=>line.trim()===f.text)).join("\n"),canonical.speaker);
    return {speaker:canonical.speaker,role:canonical.role,content:composeRoleSpeech(requiredStatements,probe.questions,draft)};
  });
  return result;
}
