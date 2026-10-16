import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("../src/services/llm.service",()=>({callDeepSeek:vi.fn()}));
import {callDeepSeek} from "../src/services/llm.service";
import {candidateCatalog,decodeJudgeRanges,EVIDENCE_PROTOCOL,EVIDENCE_PROTOCOL_HASH} from "../src/assessment/evidenceProtocol";
import {definitions,getDefinition,hash} from "../src/assessment/definitions";
import {initialState} from "../src/assessment/coverage";
import {judge,validateSample} from "../src/assessment/judge";
import {modelConfig,readSnapshot,sealSnapshot} from "../src/assessment/runtime";
import {strictJson} from "../src/assessment/strictJson";
import type {Snapshot,TranscriptMessage} from "../src/assessment/types";
const call=vi.mocked(callDeepSeek);
function fixture(index=0){
 const d=definitions[index],state=initialState(d),quotes=d.slots.map((_,i)=>`具体行为${i+1}：我核对对应事实，再明确自己的实际行动。`);
 const messages:TranscriptMessage[]=[{id:"facts",senderType:"agent",senderName:"系统",content:"任务事实已提供",roundIndex:0},{id:"answer",senderType:"user",senderName:"候选人",content:quotes.join("\n"),roundIndex:15}];
 for(const f of [...d.public_facts,...Object.values(d.role_facts).flat(),...d.events.flatMap(e=>e.facts)])state.released_facts[f.id]="facts";
 for(const slot of d.slots)state.slots[slot.slot_id].opportunities=[{question_message_id:"facts",fact_ids:slot.required_fact_ids,round:0}];
 const catalog=candidateCatalog(messages),segments=[...catalog.segments.values()];
 const ranges=quotes.map(quote=>{const start=messages[1].content.indexOf(quote),end=start+quote.length;return [segments.find(s=>s.start===start)!.id,segments.find(s=>s.end===end)!.id,"sufficient","support","可核对的独立行为"]});
 const wire:any={evaluations:d.dimensions.map((dim,i)=>[dim.id,14,"本维两个点共同支持此分档",[[ranges[i*2]],[ranges[i*2+1]]]])};
 const prompts={judge:{key:"test/ranges",content:"frozen range protocol",hash:hash("frozen range protocol")}};
 const snapshot:Snapshot=sealSnapshot({schema_version:d.schema_version,definition:d,definition_hash:hash(d),code_sha:"test",prompts,prompt_bundle_hash:hash(prompts),model:{...modelConfig(),mock:false},runtime:{group_chat_enabled:true,group_chat_rounds:[3,6]}});
 return {d,state,messages,catalog,wire,snapshot};
}
describe("server-owned candidate evidence ranges",()=>{
 beforeEach(()=>call.mockReset());
 it("preserves every original code unit, punctuation and newline without splitting emoji",()=>{
  const content="空白\n"+"甲".repeat(75)+"😀后续，否定：不能省略。\r\n ";
  const catalog=candidateCatalog([{id:"u",senderType:"user",senderName:"候选人",roundIndex:1,content},{id:"npc",senderType:"agent",senderName:"角色",roundIndex:2,content:"不能引用我"},{id:"timer",senderType:"user",senderName:"计时",roundIndex:3,content:"__ASSESSMENT_TIME_EXPIRED__"}]);
  const values=[...catalog.segments.values()];expect(values.map(s=>s.quote).join("")).toBe(content);expect(values.every(s=>s.message_id==="u")).toBe(true);
  for(const s of values){expect(content.slice(s.start,s.end)).toBe(s.quote);expect(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(s.quote)).toBe(false);}
  expect(catalog.hash).toBe(candidateCatalog([{id:"u",senderType:"user",senderName:"候选人",roundIndex:1,content}]).hash);
 });
 it("rejects duplicate input message IDs before any source ranges can be combined",()=>{const f=fixture();expect(()=>candidateCatalog([...f.messages,{...f.messages[1]}])).toThrow("消息ID重复");});
 it.each([0,1,2,3])("expands all sixteen exact quotes and frozen point IDs for scene %s",index=>{
  const f=fixture(index),sample=decodeJudgeRanges(f.wire,f.d,f.state,f.catalog);expect(()=>validateSample(sample,f.d,f.state,f.messages)).not.toThrow();
  for(const dim of sample.dimension_results)for(const point of dim.slot_results){expect(point.evidence[0].quote).toBe(f.messages[1].content.slice(point.evidence[0].start,point.evidence[0].end));expect(point.sufficiency).toBe("sufficient");expect(point.valence).toBe("support");}
  expect(sample.dimension_results.map(d=>d.name)).toEqual(f.d.dimensions.map(d=>d.name));
 });
 it.each([
  (w:any)=>w.evaluations.pop(),(w:any)=>w.evaluations.push(w.evaluations[0]),(w:any)=>w.evaluations[1][0]="GE01",
  (w:any)=>w.evaluations[0].push("extra"),(w:any)=>w.evaluations[0][3].pop(),(w:any)=>w.evaluations[0][3].push([]),
  (w:any)=>w.evaluations[0][1]=21,(w:any)=>w.evaluations[0][1]=1.2,(w:any)=>w.evaluations[0][1]=Infinity,
  (w:any)=>w.evaluations[0][3][0][0][0]="unknown-user-id",(w:any)=>w.evaluations[0][3][0][0].push("forged quote"),
  (w:any)=>w.evaluations[0][3][0][0][2]="counter",(w:any)=>w.evaluations[0][3][0][0][3]="sufficient",
  (w:any)=>w.evaluations[0][3][0][0][4]="",(w:any)=>w.extra="ignored?"
 ])("rejects ambiguous shape, extra fields, wrong order and invented ranges",mutate=>{const f=fixture();mutate(f.wire);expect(()=>decodeJudgeRanges(f.wire,f.d,f.state,f.catalog)).toThrow();});
 it("rejects cross-message and reversed ranges even when both endpoints exist",()=>{
  const f=fixture();f.messages.push({id:"later",senderType:"user",senderName:"候选人",content:"另一个回答。",roundIndex:16});const catalog=candidateCatalog(f.messages);
  f.wire.evaluations[0][3][0][0][1]="U2.1";expect(()=>decodeJudgeRanges(f.wire,f.d,f.state,catalog)).toThrow("原文范围无效");
  f.wire.evaluations[0][3][0][0][0]="U1.3";f.wire.evaluations[0][3][0][0][1]="U1.1";expect(()=>decodeJudgeRanges(f.wire,f.d,f.state,catalog)).toThrow("原文范围无效");
 });
 it("derives point sufficiency and mixed valence once, never upgrading partial to rated",()=>{
  const f=fixture(),entries=f.wire.evaluations[0][3][0];entries[0][2]="partial";
  const sample=decodeJudgeRanges(f.wire,f.d,f.state,f.catalog);expect(sample.dimension_results[0].slot_results[0].sufficiency).toBe("partial");expect(()=>validateSample(sample,f.d,f.state,f.messages)).toThrow("充分性冲突");
  f.wire.evaluations[0][1]=null;expect(()=>validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages)).not.toThrow();
  entries.push([...entries[0]]);entries[1][3]="counter";expect(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog).dimension_results[0].slot_results[0].valence).toBe("mixed");
 });
 it("keeps negative sufficient evidence distinct from missing and checks fact timing",()=>{
  const f=fixture();for(const tuple of f.wire.evaluations[0][3].flat())tuple[3]="counter";f.wire.evaluations[0][1]=2;
  expect(validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages).dimension_results[0].score).toBe(2);
  f.state.released_facts[f.d.public_facts[0].id]="answer";expect(()=>validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages)).toThrow("必要事实");
 });
 it("does not turn an empty point into zero or accept the same whole quote across dimensions",()=>{
  const f=fixture();f.wire.evaluations[0][1]=null;f.wire.evaluations[0][3]=[[],[]];
  const sample=validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages);expect(sample.dimension_results[0].score).toBeNull();expect(sample.dimension_results[0].status).toBe("insufficient");
  f.wire.evaluations[2][3][0]=f.wire.evaluations[1][3][0];expect(()=>validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages)).toThrow("跨维重复取证");
 });
 it("sends segment references without Director evidence opinions and returns canonical reports",async()=>{
  const f=fixture();call.mockResolvedValue(JSON.stringify(f.wire));const before=JSON.stringify(f.snapshot),result=await judge(f.snapshot,f.state,f.messages);
  expect(call).toHaveBeenCalledTimes(5);expect(result.sampling_stats.valid_sample_count).toBe(5);expect(result.dimension_results.every(d=>d.status==="rated")).toBe(true);
  const input=JSON.parse(call.mock.calls[0][0].userPrompt);expect(input.evidence_protocol).toBe(EVIDENCE_PROTOCOL);expect(input.messages[1].content).toBeUndefined();expect(input.messages[1].candidate_segments.length).toBeGreaterThan(16);expect(input.messages[0].content).toBe(f.messages[0].content);
  expect(result.assessment_meta.candidate_catalog_hash).toBe(f.catalog.hash);expect(JSON.stringify(f.snapshot)).toBe(before);
 });
 it("strictly rejects duplicate JSON keys and caps five invalid range lanes at ten requests",async()=>{
  const f=fixture();expect(()=>strictJson('{"evaluations":[],"evaluations":[]}')).toThrow("Duplicate JSON key");
  f.wire.evaluations[0][3][0][0][0]="NPC";call.mockResolvedValue(JSON.stringify(f.wire));const r=await judge(f.snapshot,f.state,f.messages);
  expect(call).toHaveBeenCalledTimes(10);expect(r.report_status).toBe("scoring_failed");expect(r.total_score).toBeNull();expect(r.dimension_results.every(d=>d.score===null)).toBe(true);
 });
 it("freezes protocol identity and preserves v9's original wire format",()=>{
  const f=fixture();expect(readSnapshot(JSON.stringify(f.snapshot)).model.judge.protocol_hash).toBe(EVIDENCE_PROTOCOL_HASH);
  const changed=structuredClone(f.snapshot);changed.model.judge.protocol_hash="other";expect(()=>readSnapshot(JSON.stringify(sealSnapshot(changed)))).toThrow("协议");
  const d=getDefinition(f.d.scenario_id,"ge8-20261016.9");expect(d.slots[0].slot_id).toContain(".9:");expect(modelConfig(d.assessment_version).judge.output_protocol).toBeUndefined();
 });
});
