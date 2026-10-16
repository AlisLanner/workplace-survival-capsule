import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("../src/services/llm.service",()=>({callDeepSeek:vi.fn()}));
import {callDeepSeek} from "../src/services/llm.service";
import {candidateCatalog,decodeJudgeRanges,EVIDENCE_PROTOCOL,EVIDENCE_PROTOCOL_HASH,protocolForVersion} from "../src/assessment/evidenceProtocol";
import {definitions,getDefinition,hash} from "../src/assessment/definitions";
import {initialState} from "../src/assessment/coverage";
import {judge,validateSample} from "../src/assessment/judge";
import {modelConfig,readSnapshot,sealSnapshot} from "../src/assessment/runtime";
import {strictJson} from "../src/assessment/strictJson";
import type {TranscriptMessage} from "../src/assessment/types";
const call=vi.mocked(callDeepSeek);
function fixture(index=0){
 const d=definitions[index],state=initialState(d),quotes=d.slots.map((_,i)=>`具体行为${i+1}：我核对对应事实，再明确实际行动。`);
 const messages:TranscriptMessage[]=[{id:"facts",senderType:"agent",senderName:"系统",content:"真实任务机会已提供",roundIndex:0},{id:"u",senderType:"user",senderName:"候选人",content:quotes.join("\n"),roundIndex:15}];
 for(const f of [...d.public_facts,...Object.values(d.role_facts).flat(),...d.events.flatMap(e=>e.facts)])state.released_facts[f.id]="facts";
 for(const slot of d.slots)state.slots[slot.slot_id].opportunities=[{question_message_id:"facts",fact_ids:slot.required_fact_ids,round:0}];
 const catalog=candidateCatalog(messages),segments=[...catalog.segments.values()];
 const wire:any={scores:d.dimensions.map(dim=>[dim.id,14,"两个观察点共同支持此分档"]),evidence:d.slots.map((s,i)=>{const start=messages[1].content.indexOf(quotes[i]),end=start+quotes[i].length;return [s.display_code,segments.find(s=>s.start===start)!.id,segments.find(s=>s.end===end)!.id,"sufficient","support","独立具体行为依据"]})};
 const prompts={judge:{key:"test/flat",content:"frozen flat protocol",hash:hash("frozen flat protocol")}};
 const snapshot=sealSnapshot({schema_version:d.schema_version,definition:d,definition_hash:hash(d),code_sha:"test",prompts,prompt_bundle_hash:hash(prompts),model:{...modelConfig(),mock:false},runtime:{group_chat_enabled:true,group_chat_rounds:[3,6]}});
 return {d,state,messages,catalog,wire,snapshot};
}
describe("flat score and evidence tables",()=>{
 beforeEach(()=>call.mockReset());
 it.each([0,1,2,3])("creates the canonical eight dimensions and sixteen points for scene %s",index=>{const f=fixture(index),sample=validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages);expect(sample.dimension_results.every(d=>d.score===14)).toBe(true);expect(sample.dimension_results.flatMap(d=>d.slot_results).map(s=>s.slot_id)).toEqual(f.d.slots.map(s=>s.slot_id));});
 it.each([
  (w:any)=>w.scores.pop(),(w:any)=>w.scores.push(w.scores[0]),(w:any)=>w.scores[1][0]="GE01",(w:any)=>w.scores[0].push("extra"),
  (w:any)=>w.scores[0][1]=21,(w:any)=>w.scores[0][1]=1.5,(w:any)=>w.scores[0][1]=NaN,(w:any)=>w.scores[0][2]="",
  (w:any)=>w.evidence[0][0]="unknown-point",(w:any)=>w.evidence[0][1]="NPC",(w:any)=>w.evidence[0].push("forged quote"),
  (w:any)=>w.evidence[0][3]="counter",(w:any)=>w.evidence[0][4]="sufficient",(w:any)=>w.evidence[0]=[w.evidence[0]],
  (w:any)=>w.evidence.push([...w.evidence[0]]),(w:any)=>w.evaluations=[],(w:any)=>delete w.evidence
 ])("rejects malformed rows, nested old rows, unknown codes/ranges and duplicate evidence",mutate=>{const f=fixture();mutate(f.wire);expect(()=>decodeJudgeRanges(f.wire,f.d,f.state,f.catalog)).toThrow();});
 it("retains null for absent/partial evidence rather than hiding an illegal rated dimension",()=>{
  const f=fixture();f.wire.evidence[0][3]="partial";expect(()=>validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages)).toThrow("充分性冲突");
  f.wire.scores[0][1]=null;const sample=validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages);expect(sample.dimension_results[0].status).toBe("insufficient");expect(sample.dimension_results[0].slot_results[0].sufficiency).toBe("partial");
  f.wire.evidence=[];f.wire.scores.forEach((s:any)=>s[1]=null);expect(validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages).dimension_results.every(d=>d.score===null)).toBe(true);
 });
 it("keeps negative sufficient evidence and checks facts before the quoted reply",()=>{
  const f=fixture();f.wire.evidence[0][4]="counter";f.wire.evidence[1][4]="counter";f.wire.scores[0][1]=2;
  expect(validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages).dimension_results[0].score).toBe(2);
  f.state.released_facts[f.d.public_facts[0].id]="u";expect(()=>validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages)).toThrow("必要事实");
 });
 it("groups different evidence rows once and rejects a repeated whole quote across dimensions",()=>{
  const f=fixture();const other=[...f.wire.evidence[1]];other[0]=f.wire.evidence[0][0];other[4]="counter";f.wire.evidence.push(other);
  expect(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog).dimension_results[0].slot_results[0].valence).toBe("mixed");
  f.wire.evidence[2][1]=f.wire.evidence[0][1];f.wire.evidence[2][2]=f.wire.evidence[0][2];expect(()=>validateSample(decodeJudgeRanges(f.wire,f.d,f.state,f.catalog),f.d,f.state,f.messages)).toThrow("跨维重复取证");
 });
 it("uses five flat responses, exact original text and frozen protocol metadata",async()=>{
  const f=fixture();call.mockResolvedValue(JSON.stringify(f.wire));const before=JSON.stringify(f.snapshot),r=await judge(f.snapshot,f.state,f.messages);expect(call).toHaveBeenCalledTimes(5);expect(r.sampling_stats.valid_sample_count).toBe(5);expect(r.report_status).toBe("confident");
  expect(JSON.parse(call.mock.calls[0][0].userPrompt).evidence_protocol).toBe(EVIDENCE_PROTOCOL);expect(r.assessment_meta.candidate_catalog_hash).toBe(f.catalog.hash);expect(JSON.stringify(f.snapshot)).toBe(before);
 });
 it("never accepts duplicated root keys or silently converts failed lanes to missing",async()=>{
  const f=fixture();expect(()=>strictJson('{"scores":[],"scores":[],"evidence":[]}')).toThrow("Duplicate JSON key");call.mockResolvedValue('{"scores":[],"evidence":[]}');const r=await judge(f.snapshot,f.state,f.messages);expect(call).toHaveBeenCalledTimes(10);expect(r.report_status).toBe("scoring_failed");expect(r.total_score).toBeNull();
 });
 it("retains separate v9, v10 and v11 protocol identities, rejecting a resealed mixture",()=>{
  const f=fixture();expect(protocolForVersion("ge8-20261016.9")).toBeUndefined();expect(protocolForVersion("ge8-20261016.10")).toBe("ge8-evidence-ranges/1");expect(protocolForVersion(f.d.assessment_version)).toBe(EVIDENCE_PROTOCOL);expect(readSnapshot(JSON.stringify(f.snapshot)).model.judge.protocol_hash).toBe(EVIDENCE_PROTOCOL_HASH);
  const old=getDefinition(f.d.scenario_id,"ge8-20261016.10"),mixed=sealSnapshot({...f.snapshot,definition:old,definition_hash:hash(old)});expect(()=>readSnapshot(JSON.stringify(mixed))).toThrow("协议");
 });
});
