import {describe,expect,it} from "vitest";
import {definitions,getDefinition,hash} from "../src/assessment/definitions";
import {delivered,initialState,locateEvidence,nextProbe} from "../src/assessment/coverage";
import {answeredOpportunities} from "../src/assessment/responseQuality";
import {evaluationFixture} from "../src/assessment/evaluation";
import {candidateCatalog,decodeJudgeRanges} from "../src/assessment/evidenceProtocol";
import {aggregateSamples,validateSample} from "../src/assessment/judge";
import {modelConfig} from "../src/assessment/runtime";
import type {Snapshot} from "../src/assessment/types";

function fixture(index=0) {
  const d=definitions[index],f=evaluationFixture(d,"vague"),catalog=candidateCatalog(f.messages);
  const wire={scores:d.dimensions.map(dim=>[dim.id,8,"明确问到的两个点均只表达重视，未具体说明所问的依据或行动，按有限表现评分。"]),evidence:d.slots.map(slot=>{
    const link=answeredOpportunities(slot.slot_id,d,f.state,f.messages)[0];
    const segments=[...catalog.segments.values()].filter(s=>s.message_id===link.response_message_id);
    return [slot.display_code,segments[0].id,segments.at(-1)!.id,"partial","mixed",`${slot.display_code}明确询问${slot.probe_intent}，实际回应仅为笼统态度，没有展开该项。`];
  })};
  const sample=()=>validateSample(decodeJudgeRanges(wire,d,f.state,catalog),d,f.state,f.messages);
  return {...f,d,catalog,wire,sample};
}
describe("response quality is distinct from completeness and missing opportunity",()=>{
  it.each([0,1,2,3])("scores a limited response to each actual question without requiring a perfect answer: %s",index=>{
    const f=fixture(index),s=f.sample();expect(s.dimension_results.every(d=>d.score===8)).toBe(true);
    expect(s.dimension_results.flatMap(d=>d.slot_results).every(s=>s.evidence[0].response_context?.answered_opportunities===1)).toBe(true);
    const snapshot:Snapshot={schema_version:f.d.schema_version,definition:f.d,definition_hash:hash(f.d),code_sha:"test",prompts:{},prompt_bundle_hash:hash({}),model:{...modelConfig(),mock:false}};
    const report=aggregateSamples(Array.from({length:5},f.sample),snapshot,f.state);expect(report.total_score).toBe(64);expect(report.report_status).toBe("confident");
  });
  it("does not withhold a score when both points have scorable but incomplete responses",()=>{
    const f=fixture();f.wire.scores[0][1]=null as any;expect(f.sample).toThrow("表现质量");
  });
  it("does not rate partial evidence without the actual neutral question, or accept invented context",()=>{
    const f=fixture();f.state.slots[f.d.slots[0].slot_id].opportunities=[];expect(f.sample).toThrow("充分性冲突");
    const e=decodeJudgeRanges(f.wire,f.d,f.state,f.catalog).dimension_results[0].slot_results[0].evidence[0];
    e.response_context={question_message_id:"invented",answered_opportunities:99};expect(locateEvidence(e,f.d,f.state,f.messages).response_context).toBeUndefined();
  });
  it("does not turn one vague response into 0—5, or a partial performance into 16—20",()=>{
    const f=fixture();f.wire.scores[0][1]=3;expect(f.sample).toThrow("实际中性追问");f.wire.scores[0][1]=18;expect(f.sample).toThrow("16—20");
  });
  it("counts follow-ups only after a candidate response and before the cited response",()=>{
    const f=fixture(),slot=f.d.slots[0],first=answeredOpportunities(slot.slot_id,f.d,f.state,f.messages)[0];
    const q={id:"followup",senderType:"agent",senderName:"角色",content:slot.probe_intent,roundIndex:14};
    f.messages.push(q);delivered({agent:slot.target_agent,slot_ids:[slot.slot_id],questions:[slot.probe_intent],facts:[],event_ids:[]},q.id,14,f.state,f.d);
    expect(answeredOpportunities(slot.slot_id,f.d,f.state,f.messages)).toHaveLength(1);
    f.messages.push({id:"second",senderType:"user",senderName:"候选人",content:"我仍不说明具体行动。",roundIndex:15});
    const e={slot_id:slot.slot_id,message_id:"second",quote:"我仍不说明具体行动。",sufficiency:"partial" as const,valence:"counter" as const,reason:"明确追问后拒绝展开行动"};
    expect(locateEvidence(e,f.d,f.state,f.messages).response_context?.answered_opportunities).toBe(2);
    expect(locateEvidence({...e,message_id:first.response_message_id,quote:f.messages.find(m=>m.id===first.response_message_id)!.content},f.d,f.state,f.messages).response_context?.answered_opportunities).toBe(1);
  });
  it("retains real absence, timer expiry and technical failure as missing rather than low scores",()=>{
    const d=definitions[0],f=evaluationFixture(d,"missing"),wire={scores:d.dimensions.map(dim=>[dim.id,null,"未获得候选人回应"]),evidence:[]};
    expect(d.slots.every(slot=>!answeredOpportunities(slot.slot_id,d,f.state,f.messages).length)).toBe(true);
    expect(validateSample(decodeJudgeRanges(wire,d,f.state,candidateCatalog(f.messages)),d,f.state,f.messages).dimension_results.every(d=>d.score===null)).toBe(true);
  });
  it.each([0,1,2,3])("does not allow repeated Director suggestions to leave any point unasked in fifteen answers: %s",index=>{
    const d=definitions[index],state=initialState(d),opening=d.slots.filter(s=>s.target_agent==="leader").slice(0,2);
    delivered({agent:"leader",slot_ids:opening.map(s=>s.slot_id),questions:opening.map(s=>s.probe_intent),facts:[...d.public_facts,...d.role_facts.leader],event_ids:[]},"opening",0,state,d);
    for(let round=1;round<15;round++){state.round=round;const p=nextProbe(d,state,{agent:"leader",slot_ids:opening.map(s=>s.slot_id)});delivered(p,`q${round}`,round,state,d);expect(state.consecutive_agent).toBeLessThanOrEqual(2);}
    expect(d.slots.filter(s=>!state.slots[s.slot_id].opportunities.length).map(s=>s.display_code)).toEqual([]);
    for(const event of d.events)expect(state.released_events[event.id]).toBe(`q${event.round}`);
  });
  it("keeps v11 rules frozen, including the old verbose-missing fixture and duplicate-quote rejection",()=>{
    const old=getDefinition(definitions[0].scenario_id,"ge8-20261016.11");expect(old.scoring_policy.evidence_policy).toBeUndefined();
    const f=evaluationFixture(old,"missing");expect(f.messages.filter(m=>m.senderType==="user")).toHaveLength(8);
    const current=fixture(),prior=evaluationFixture(old,"vague"),catalog=candidateCatalog(prior.messages);
    expect(()=>validateSample(decodeJudgeRanges(current.wire,old,prior.state,catalog),old,prior.state,prior.messages)).toThrow("充分性冲突");
  });
  it("accepts an independently expressed concrete behavior without requiring a targeted question",()=>{
    const f=fixture();for(const slot of f.d.slots)f.state.slots[slot.slot_id].opportunities=[];
    // Distinct specific fragments stand in for already independently judged sufficient behavior.
    f.messages.filter(m=>m.senderType==="user").forEach((m,i)=>m.content=`第一项具体行动${i}。第二项具体行动${i}。`);
    const catalog=candidateCatalog(f.messages),wire={scores:f.d.dimensions.map(d=>[d.id,12,"依据主动表达的具体行动判断"]),evidence:f.d.slots.map((slot,i)=>{const seg=[...catalog.segments.values()][i];return [slot.display_code,seg.id,seg.id,"sufficient","support","明确具体行为"]})};
    expect(validateSample(decodeJudgeRanges(wire,f.d,f.state,catalog),f.d,f.state,f.messages).dimension_results.every(d=>d.score===12)).toBe(true);
  });
});
