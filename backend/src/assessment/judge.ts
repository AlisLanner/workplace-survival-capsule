import { callDeepSeek } from "../services/llm.service";
import { auditedCall } from "./audit";
import { coverage, locateEvidence, opportunityFor } from "./coverage";
import { strictJson } from "./strictJson";
import { publicMeta } from "./runtime";
import type { Definition, DimensionResult, Evidence, Ge8Report, Ge8State, SlotResult, Snapshot, TranscriptMessage } from "./types";

export interface JudgeSample { dimension_results:DimensionResult[] }
export interface Attempt { sample:number; attempt:number; ok:boolean; error?:string; elapsed_ms:number }
export function validateSample(input:unknown,d:Definition,state:Ge8State,messages:TranscriptMessage[]):JudgeSample {
  const x=input as JudgeSample;
  if(!x || !Array.isArray(x.dimension_results) || x.dimension_results.length!==8)throw new Error("Judge必须返回8维");
  const seen=new Set<string>(); const usedQuotes=new Map<string,string>();
  const results=x.dimension_results.map((dim,i)=>{
    const def=d.dimensions[i];
    if(!dim || dim.id!==def.id || dim.name!==def.name || seen.has(dim.id))throw new Error("维度错名、错序或重复");seen.add(dim.id);
    if(!["rated","not_observed","insufficient"].includes(dim.status) || (dim.status==="rated"? !Number.isInteger(dim.score) || dim.score!<0 || dim.score!>20 : dim.score!==null))throw new Error("分值和状态不一致");
    if(!dim.analysis?.trim() || !Array.isArray(dim.slot_results) || dim.slot_results.length!==2)throw new Error("维度缺少解释或2个观察点");
    const slots=d.slots.filter(s=>s.dimension_id===dim.id);
    const slotResults=dim.slot_results.map((slot,j):SlotResult=>{
      if(!slot || slot.slot_id!==slots[j].slot_id || !["none","partial","sufficient"].includes(slot.sufficiency) || !Array.isArray(slot.evidence))throw new Error("观察点错序、重复或非法");
      if(![null,"support","counter","mixed"].includes(slot.valence))throw new Error("观察点表现方向无效");
      const evidence=slot.evidence.map(e=>{if(e.slot_id!==slot.slot_id)throw new Error("证据指向不同观察点");return locateEvidence(e,d,state,messages);});
      if(slot.sufficiency==="sufficient" && !evidence.some(e=>e.sufficiency==="sufficient"))throw new Error("充分观察点必须有可判断原话");
      if(slot.sufficiency==="none" && evidence.length)throw new Error("未观察点不能携带证据");
      if(evidence.length && slot.valence===null)throw new Error("证据缺少正负方向");
      const opportunity=evidence.length?opportunityFor(slot.slot_id,state,d):(state.slots[slot.slot_id]?.opportunities??[]);
      if(dim.status==="rated" && (slot.sufficiency!=="sufficient" || !opportunity.length))throw new Error("缺少充分机会与两点证据不能评分");
      for(const e of evidence){const key=e.message_id+":"+e.quote;const other=usedQuotes.get(key);if(other && other!==dim.id)throw new Error("同一原话片段跨维重复取证，需指出独立行为片段");usedQuotes.set(key,dim.id);}
      return {slot_id:slot.slot_id,opportunity,sufficiency:slot.sufficiency,valence:slot.valence,evidence};
    });
    if(dim.status==="not_observed" && slotResults.every(s=>s.opportunity.length))throw new Error("已提供两个机会应区分证据不足");
    return {id:def.id,name:def.name,score:dim.score,status:dim.status,analysis:dim.analysis,slot_results:slotResults};
  });
  return {dimension_results:results};
}
const variance=(v:number[])=>{const m=v.reduce((s,x)=>s+x,0)/v.length;return v.reduce((s,x)=>s+(x-m)**2,0)/v.length;};
export function aggregateSamples(samples:JudgeSample[],snapshot:Snapshot,state:Ge8State,attempts:Attempt[]=[]):Ge8Report {
  const d=snapshot.definition;const technical=samples.length!==5;
  const review:string[]=technical?["valid_samples_below_five"]:[];
  const stats:Record<string,unknown>={sample_count:5,valid_sample_count:samples.length,attempts,dimension_stats:{},scores:[],variance:null};
  const dimStats=stats.dimension_stats as Record<string,unknown>;
  const results=d.dimensions.map((def,i):DimensionResult=>{
    const dims=samples.map(s=>s.dimension_results[i]);
    const rated=dims.filter(r=>r.status==="rated");const scores=rated.map(r=>r.score!);
    if(scores.length)dimStats[def.id]={rated_count:scores.length,min:Math.min(...scores),max:Math.max(...scores),range:Math.max(...scores)-Math.min(...scores),variance:variance(scores)};
    if(technical || rated.length!==5) {
      if(!technical)review.push(`missing:${def.id}`);
      const missing=dims.find(r=>r.status!=="rated");
      return {id:def.id,name:def.name,score:null,status:technical?"scoring_failed":missing?.status??"insufficient",analysis:technical?"评分技术失败；对话和原始失败已保留，未生成分数。":missing?.analysis??"证据不足，需复核。",slot_results:missing?.slot_results??d.slots.filter(s=>s.dimension_id===def.id).map(s=>({slot_id:s.slot_id,opportunity:state.slots[s.slot_id].opportunities,sufficiency:"none",valence:null,evidence:[]}))};
    }
    const sorted=[...scores].sort((a,b)=>a-b);const score=Math.round((sorted[1]+sorted[2]+sorted[3])/3);
    const anchor=rated.reduce((a,b)=>Math.abs(a.score!-score)<=Math.abs(b.score!-score)?a:b);
    const spread=sorted[4]-sorted[0];
    if(spread>=d.scoring_policy.dimension_range_limit || (sorted[0]<=5 && sorted[4]>=16))review.push(`dimension_disagreement:${def.id}`);
    return {...anchor,score,analysis:`${anchor.analysis} 聚合分数${score}/20；五次评分范围${sorted[0]}—${sorted[4]}。${spread>=d.scoring_policy.dimension_range_limit?"逐维分歧达到工程告警值，建议复核。":""}`};
  });
  const allRated=!technical && samples.every(s=>s.dimension_results.every(r=>r.status==="rated"));
  let totalVariance:number|null=null;
  if(allRated){const totals=samples.map(s=>s.dimension_results.reduce((sum,r)=>sum+r.score!,0));totalVariance=variance(totals);stats.scores=totals;stats.variance=totalVariance;}
  if(totalVariance!==null && totalVariance>=d.scoring_policy.total_variance_limit)review.push("total_variance_limit");
  const c={covered_dimensions:results.filter(r=>r.status==="rated").map(r=>r.name),insufficient_dimensions:results.filter(r=>r.status!=="rated").map(r=>r.name),complete:results.every(r=>r.status==="rated")};
  // The Judge may correct missed Director evidence only through validated per-slot citations.
  const status=technical?"scoring_failed":snapshot.model.mock?"debug":!c.covered_dimensions.length?"unratable":!c.complete?"provisional":review.includes("total_variance_limit")?"unratable":review.length?"provisional":"confident";
  const scores=Object.fromEntries(results.filter(r=>r.status==="rated").map(r=>[r.name,r.score!]));
  return {assessment_version:d.assessment_version,schema_version:d.schema_version,scenario_id:d.scenario_id,dimension_results:results,dimension_scores:scores,dimension_analysis:Object.fromEntries(results.map(r=>[r.name,r.analysis])),
    total_score:status==="confident"?Object.values(scores).reduce((a,b)=>a+b,0):null,radar_chart_data:c.complete?results.map(r=>({name:r.name,score:r.score!,max:20})):[],
    report_status:status,level:"本次行为观察",summary:`本情境八维中${c.covered_dimensions.length}维具有五份合法的可评分结果。${snapshot.model.mock?"本报告由模拟器生成，仅用于程序检查。":"结果仅表示本次情境中的判断和行为表达。"}`,
    conflict_style:"仅依据本情境原话描述，不作人格诊断。",strengths:[],risks:review,suggestions:["结合逐点原话和任务条件进行人工复核。"],final_recommendation:"本结果为人工面试和复核提供线索，不设置招聘淘汰线；新旧版本及跨情境分数不能直接比较。",
    evidence:results.flatMap(r=>r.slot_results.flatMap(s=>s.evidence.map(e=>({dimension:r.name,message_id:e.message_id,quote:e.quote,analysis:e.reason})))),
    mock_generated:snapshot.model.mock,human_review_required:status!=="confident",human_review_reason:review.join("；"),review_reasons:review,sampling_stats:stats,assessment_meta:publicMeta(snapshot),coverage_status:c};
}

export function mockSample(snapshot:Snapshot,state:Ge8State):JudgeSample {
  const d=snapshot.definition;
  return {dimension_results:d.dimensions.map(dim=>{
    const slots=d.slots.filter(s=>s.dimension_id===dim.id).map((s):SlotResult=>{const e=state.slots[s.slot_id].evidence.filter(x=>x.sufficiency==="sufficient");return {slot_id:s.slot_id,opportunity:e.length?opportunityFor(s.slot_id,state,d):state.slots[s.slot_id].opportunities,sufficiency:e.length?"sufficient":"none",valence:e[0]?.valence??null,evidence:e};});
    const full=slots.every(s=>s.evidence.length);return {id:dim.id,name:dim.name,score:full?(slots.some(s=>s.valence==="counter")?3:14):null,status:full?"rated":slots.every(s=>s.opportunity.length)?"insufficient":"not_observed",analysis:"合成程序样例，仅检查字段和缺失语义，不代表模型评分质量。",slot_results:slots};
  })};
}
export async function judge(snapshot:Snapshot,state:Ge8State,messages:TranscriptMessage[],progress?:(count:number)=>void):Promise<Ge8Report> {
  const attempts:Attempt[]=[];let count=0;
  const results=await Promise.all(Array.from({length:5},async(_,sample)=>{
    for(let attempt=1;attempt<=snapshot.model.max_attempts;attempt++) {
      const started=Date.now();
      try {
        const params=snapshot.model.judge;
        const raw=snapshot.model.mock?JSON.stringify(mockSample(snapshot,state)):await auditedCall(`judge/${sample}/${attempt}`,{systemPrompt:snapshot.prompts.judge.content,userPrompt:JSON.stringify({definition:snapshot.definition,opportunities:state.slots,released_facts:state.released_facts,messages}),model:snapshot.model.judge_model,temperature:params.temperature,maxTokens:params.max_tokens,thinking:params.thinking,timeoutMs:params.timeout_ms,baseUrl:snapshot.model.base_url,maxAttempts:1,allowMockFallback:false});
        const result=validateSample(strictJson(raw),snapshot.definition,state,messages);attempts.push({sample,attempt,ok:true,elapsed_ms:Date.now()-started});progress?.(++count);return result;
      }catch(error){attempts.push({sample,attempt,ok:false,error:error instanceof Error?error.message:String(error),elapsed_ms:Date.now()-started});}
    }
    progress?.(++count);return null;
  }));
  return aggregateSamples(results.filter((x):x is JudgeSample=>x!==null),snapshot,state,attempts);
}
