import { describe, expect, it } from "vitest";
import { definitions, dimensions, getDefinition, hash, validateDefinitions } from "../src/assessment/definitions";
import { agentView, coverage, delivered, initialState, locateEvidence, nextProbe, publicState, recordEvidence } from "../src/assessment/coverage";
import { strictJson } from "../src/assessment/strictJson";
import { aggregateSamples, mockSample, validateSample } from "../src/assessment/judge";
import { modelConfig } from "../src/assessment/runtime";
import type { Evidence, Snapshot, TranscriptMessage } from "../src/assessment/types";

function fixture(index=0) {
  const d=structuredClone(definitions[index]);const state=initialState(d);
  const factMessage={id:"facts",senderType:"agent",senderName:"系统",content:"事实",roundIndex:0};
  const messages:TranscriptMessage[]=[factMessage];
  for(const f of [...d.public_facts,...Object.values(d.role_facts).flat(),...d.events.flatMap(e=>e.facts)])state.released_facts[f.id]="facts";
  const evidence:Evidence[]=d.slots.map((slot,i)=>{
    const quote=`具体行为${i}：本人就该任务给出可核对的判断及行动。`;
    const id=`u${i}`;messages.push({id,senderType:"user",senderName:"候选人",content:quote,roundIndex:i+1});
    return {slot_id:slot.slot_id,message_id:id,quote,sufficiency:"sufficient",valence:"support",reason:"独立片段"};
  });
  recordEvidence(evidence,d,state,messages);
  const snapshot:Snapshot={schema_version:d.schema_version,definition:d,definition_hash:hash(d),code_sha:"test",prompts:{},prompt_bundle_hash:hash({}),model:{...modelConfig(),mock:false}};
  const sample=mockSample(snapshot,state);sample.dimension_results.forEach(r=>r.score=14);
  return {d,state,messages,snapshot,sample,evidence};
}
describe("GE8 measurement contract",()=>{
  it("registers exactly A/B/C/E with authoritative names, 64 unique points and explicit roles",()=>{
    expect(definitions.map(d=>d.scenario_code)).toEqual(["A","B","C","E"]);
    expect(dimensions.map(d=>d.name)).toEqual(["领导与决策","支持与合作","互动与呈现","分析与解释","创造与概念化","组织与执行","适应与应对","进取与绩效"]);
    expect(()=>validateDefinitions()).not.toThrow();expect(new Set(definitions.flatMap(d=>d.slots.map(s=>s.slot_id))).size).toBe(64);
    expect(definitions[1].roles.leader).toEqual({name:"刘总",role:"8号桌客人"});expect(definitions[2].roles.client.name).toBe("老周");
    expect(definitions[3].user_role).toBe("无指挥权新人");expect(()=>getDefinition("unknown")).toThrow();expect(()=>getDefinition(definitions[0].scenario_id,"unknown")).toThrow();
  });
  it("rejects duplicate IDs, broken fact references and wrong per-dimension counts",()=>{
    for(const change of [(d:any)=>d.slots[1].slot_id=d.slots[0].slot_id,(d:any)=>d.slots[0].required_fact_ids.push("missing"),(d:any)=>d.slots[0].dimension_id="GE08"]){const d=structuredClone(definitions[0]);change(d);expect(()=>validateDefinitions([d])).toThrow();}
  });
  it("distinguishes scheduling from actual delivery and partial from sufficient evidence",()=>{
    const {d,messages,evidence}=fixture();const state=initialState(d);const p=nextProbe(d,state);
    expect(Object.values(state.slots).every(s=>s.opportunities.length===0)).toBe(true);
    for(const f of d.public_facts)state.released_facts[f.id]="facts";
    delivered(p,"question",1,state,d);expect(coverage(d,state).complete).toBe(false);
    recordEvidence([{...evidence[0],sufficiency:"partial"}],d,state,messages);expect(coverage(d,state).complete).toBe(false);
  });
  it("requires both points in all eight dimensions and accepts sufficiently negative evidence",()=>{
    const {d,state,messages,evidence}=fixture();expect(coverage(d,state).complete).toBe(true);
    state.slots[d.slots[1].slot_id].evidence=[];expect(coverage(d,state).complete).toBe(false);
    expect(recordEvidence([{...evidence[1],valence:"counter"}],d,state,messages)).toEqual([]);expect(coverage(d,state).complete).toBe(true);
  });
  it("blocks NPC quotes, forged text, wrong slot versions and future facts",()=>{
    const {d,state,messages,evidence}=fixture();
    for(const e of [{...evidence[0],message_id:"facts"},{...evidence[0],quote:"不存在原话"},{...evidence[0],slot_id:"A1"}])expect(()=>locateEvidence(e,d,state,messages)).toThrow();
    delete state.released_facts[d.public_facts[0].id];expect(()=>locateEvidence(evidence[0],d,state,messages)).toThrow();
    expect(recordEvidence([{detected_behavior:{accept_responsibility:true}}],d,state,messages).length).toBe(1);
  });
  it("keeps anchors, observations, templates and unreleased private facts out of NPC input and public state",()=>{
    const {d,state}=fixture();state.released_facts={};const p=nextProbe(d,state);p.agent="leader";
    const text=JSON.stringify(agentView("npc",d,state,p,[]));
    expect(text).not.toContain("anchors");expect(text).not.toContain("dimension_id");expect(text).not.toContain(d.role_facts.client[0].text);
    expect(JSON.stringify(publicState(state))).not.toContain("slots");
  });
  it.each([0,1,2,3])("validates fixed change delivery before the sixth round for scene %s",index=>{
    const {d}=fixture(index);const state=initialState(d);for(const f of d.public_facts)state.released_facts[f.id]="facts";
    for(let round=1;round<=5;round++){state.round=round;const p=nextProbe(d,state);delivered(p,`q${round}`,round,state,d);}
    expect(state.released_events[d.events[1].id]).toBeDefined();
  });
});
describe("strict scoring and missing semantics",()=>{
  it.each(['{"a":1,"a":2}','{"x":{"a":1,"a":2}}','{"a":NaN}','{"x":1} trailing','{}{}'])('rejects ambiguous JSON %s',text=>expect(()=>strictJson(text)).toThrow());
  it("allows repeated names in different objects, unicode keys and escaped characters",()=>expect(strictJson('{"a":[{"x":1},{"x":2}],"\\u4e2d":"a\\\"b"}')).toEqual({a:[{x:1},{x:2}],中:'a"b'}));
  it.each([0,1,2,3])("accepts a complete sample for scene %s",index=>{const f=fixture(index);expect(()=>validateSample(f.sample,f.d,f.state,f.messages)).not.toThrow();});
  it.each([
    (s:any)=>s.dimension_results.pop(),(s:any)=>s.dimension_results.push(s.dimension_results[0]),(s:any)=>s.dimension_results[1]=s.dimension_results[0],
    (s:any)=>s.dimension_results[0].name="信息辨别",(s:any)=>s.dimension_results[0].score=21,(s:any)=>s.dimension_results[0].score=-1,(s:any)=>s.dimension_results[0].score=Infinity,(s:any)=>s.dimension_results[0].score=1.5,
    (s:any)=>s.dimension_results[0].score=null,(s:any)=>s.dimension_results[0].status="insufficient",(s:any)=>s.dimension_results[0].slot_results[0].evidence[0].quote="伪造",
    (s:any)=>s.dimension_results[0].slot_results[1]=s.dimension_results[0].slot_results[0],(s:any)=>s.dimension_results[0].slot_results[0].valence=null
  ])("rejects illegal scores, missing/extra/duplicate dimensions and fabricated quotes",mutate=>{const f=fixture();mutate(f.sample);expect(()=>validateSample(f.sample,f.d,f.state,f.messages)).toThrow();});
  it("trims each dimension independently then rounds integers and sums",()=>{
    const f=fixture();const samples=[10,12,13,14,16].map(score=>{const s=structuredClone(f.sample);s.dimension_results.forEach(d=>d.score=score);return s;});
    const r=aggregateSamples(samples,f.snapshot,f.state);expect(r.dimension_results.map(d=>d.score)).toEqual(Array(8).fill(13));expect(r.total_score).toBe(null);expect(r.report_status).toBe("unratable");
    const stable=aggregateSamples(Array.from({length:5},()=>structuredClone(f.sample)),f.snapshot,f.state);expect(stable.total_score).toBe(112);expect(stable.radar_chart_data).toHaveLength(8);
  });
  it("missing one sample dimension never inserts zero or closes a radar",()=>{
    const f=fixture();const samples=Array.from({length:5},()=>structuredClone(f.sample));samples[0].dimension_results[0].score=null;samples[0].dimension_results[0].status="insufficient";
    const r=aggregateSamples(samples,f.snapshot,f.state);expect(r.total_score).toBeNull();expect(r.dimension_scores).not.toHaveProperty("领导与决策");expect(r.dimension_results[0].score).toBeNull();expect(r.radar_chart_data).toEqual([]);expect(r.report_status).toBe("provisional");
  });
  it("does not aggregate 3 or 4 valid samples as five",()=>{const f=fixture();for(const n of [0,3,4]){const r=aggregateSamples(Array(n).fill(f.sample),f.snapshot,f.state);expect(r.report_status).toBe("scoring_failed");expect(r.total_score).toBeNull();}});
  it("flags dimension disagreement even when total variance is zero",()=>{
    const f=fixture();const samples=[2,10,10,10,18].map(v=>{const s=structuredClone(f.sample);s.dimension_results[0].score=v;s.dimension_results[1].score=20-v;return s;});
    const r=aggregateSamples(samples,f.snapshot,f.state);expect(r.sampling_stats.variance).toBe(0);expect(r.report_status).toBe("provisional");expect(r.review_reasons).toContain("dimension_disagreement:GE01");
  });
  it("mock reports never expose a formal total",()=>{const f=fixture();f.snapshot.model.mock=true;const r=aggregateSamples(Array(5).fill(f.sample),f.snapshot,f.state);expect(r.report_status).toBe("debug");expect(r.total_score).toBeNull();});
  it("does not attach high-band praise to an aggregate in an unrepresented lower band",()=>{
    const f=fixture();const samples=[2,2,18,18,18].map(score=>{const s=structuredClone(f.sample);s.dimension_results[0].score=score;s.dimension_results[0].analysis=score>15?"高档样本表扬":"低档样本批评";return s;});
    const r=aggregateSamples(samples,f.snapshot,f.state);expect(r.dimension_results[0].score).toBe(13);expect(r.dimension_results[0].analysis).not.toContain("样本表");expect(r.dimension_results[0].analysis).toContain("人工复核");expect(r.review_reasons).toContain("aggregate_explanation_crosses_band:GE01");
  });
});
