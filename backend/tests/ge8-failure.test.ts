import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("../src/services/llm.service",()=>({callDeepSeek:vi.fn()}));
import {callDeepSeek} from "../src/services/llm.service";
import {judge,mockSample} from "../src/assessment/judge";
import {initialState} from "../src/assessment/coverage";
import {definitions,hash} from "../src/assessment/definitions";
import {modelConfig,readSnapshot,sealSnapshot} from "../src/assessment/runtime";
import type {Snapshot} from "../src/assessment/types";
import {director} from "../src/assessment/agents";
import {nextProbe} from "../src/assessment/coverage";
const call=vi.mocked(callDeepSeek);
function fixture(){const d=definitions[0];const state=initialState(d);const prompts={judge:{key:"test/judge",content:"frozen",hash:hash("frozen")}};const snapshot:Snapshot=sealSnapshot({schema_version:d.schema_version,definition:d,definition_hash:hash(d),code_sha:"test",prompts,prompt_bundle_hash:hash(prompts),model:{...modelConfig(),mock:false},runtime:{group_chat_enabled:true,group_chat_rounds:[3,6]}});return {snapshot,state,raw:JSON.stringify(mockSample(snapshot,state))};}
describe("bounded GE8 failures",()=>{
  beforeEach(()=>call.mockReset());afterEach(()=>vi.unstubAllEnvs());
  it("caps five broken lanes at ten total requests, never scoring four samples",async()=>{const f=fixture();call.mockResolvedValue('{"dimension_results":[]}');const r=await judge(f.snapshot,f.state,[]);expect(call).toHaveBeenCalledTimes(10);expect(r.report_status).toBe("scoring_failed");expect(r.total_score).toBeNull();expect(r.sampling_stats.valid_sample_count).toBe(0);});
  it("replaces one failed lane rather than aggregating a sixth sample",async()=>{const f=fixture();call.mockRejectedValueOnce(new Error("429 synthetic")).mockResolvedValue(f.raw);const r=await judge(f.snapshot,f.state,[]);expect(call).toHaveBeenCalledTimes(6);expect(r.sampling_stats.valid_sample_count).toBe(5);expect(r.report_status).toBe("unratable");expect((r.sampling_stats.attempts as any[]).filter(x=>!x.ok)).toHaveLength(1);});
  it("freezes real mode, model, endpoint and one network attempt for each lane",async()=>{const f=fixture();vi.stubEnv("USE_MOCK_LLM","true");call.mockResolvedValue(f.raw);await judge(f.snapshot,f.state,[]);expect(call.mock.calls[0][0]).toMatchObject({mockMode:false,model:f.snapshot.model.judge_model,baseUrl:f.snapshot.model.base_url,maxAttempts:1,allowMockFallback:false});});
  it("rejects a corrupted definition or template snapshot instead of loading latest",()=>{const f=fixture();expect(()=>readSnapshot(JSON.stringify(f.snapshot))).not.toThrow();f.snapshot.prompts.judge.content="changed";expect(()=>readSnapshot(JSON.stringify(f.snapshot))).toThrow();expect(()=>readSnapshot(null)).toThrow();});
  it("ignores explicit absent evidence instead of failing on its empty quote or filling coverage",async()=>{
    const f=fixture();f.snapshot.prompts.director=f.snapshot.prompts.judge;call.mockResolvedValue(JSON.stringify({slot_evidence:[{slot_id:f.snapshot.definition.slots[0].slot_id,sufficiency:"none",quote:""}],should_finish:false}));
    const r=await director(f.snapshot,f.state,nextProbe(f.snapshot.definition,f.state),[]);expect(r.slot_evidence).toEqual([]);expect(call).toHaveBeenCalledTimes(1);expect(Object.values(f.state.slots).every(s=>!s.evidence.length)).toBe(true);
  });
  it("keeps Director sufficiency and valence opinions out of the independent Judge request",async()=>{
    const f=fixture();for(const slot of Object.values(f.state.slots))slot.evidence=[{quote:"导演事先认为表现充分",sufficiency:"partial",valence:"counter",reason:"非独立判断"} as any];
    call.mockResolvedValue(f.raw);await judge(f.snapshot,f.state,[]);
    const input=JSON.parse(call.mock.calls[0][0].userPrompt);expect(JSON.stringify(input)).not.toContain("导演事先认为");expect(Object.values(input.opportunities).every((s:any)=>Array.isArray(s.opportunities)&&!("evidence" in s))).toBe(true);
  });
  it("feeds the actual validator error to the one permitted repair without changing frozen input",async()=>{
    const f=fixture();f.snapshot.prompts.director=f.snapshot.prompts.judge;call.mockResolvedValueOnce('{} trailing').mockResolvedValueOnce('{"slot_evidence":[],"should_finish":false}');
    await director(f.snapshot,f.state,nextProbe(f.snapshot.definition,f.state),[]);expect(call).toHaveBeenCalledTimes(2);const repaired=JSON.parse(call.mock.calls[1][0].userPrompt);expect(repaired.repair.validation_error).toContain("Trailing JSON content at position");expect(repaired.scenario_id).toBe(f.snapshot.definition.scenario_id);expect(repaired.messages).toEqual([]);
  });
  it("extracts the latest reply once without echoing historical quotes, while preserving old snapshot behavior",async()=>{
    const f=fixture();f.snapshot.prompts.director=f.snapshot.prompts.judge;
    const d=f.snapshot.definition,slot=d.slots[0];for(const fact of d.public_facts)f.state.released_facts[fact.id]="facts";
    const messages=[{id:"facts",senderType:"agent",senderName:"系统",content:"任务事实",roundIndex:0},{id:"old",senderType:"user",senderName:"候选人",content:"我承担协调责任",roundIndex:1},{id:"latest",senderType:"user",senderName:"候选人",content:"我现在确认下一步安排",roundIndex:15}];
    const old={slot_id:slot.slot_id,message_id:"old",quote:"我承担协调责任",sufficiency:"sufficient",valence:"support",reason:"已保存历史片段"};
    f.state.slots[slot.slot_id].evidence=[old as any];
    const fresh={...old,message_id:"latest",quote:"我现在确认下一步安排",reason:"最新回应"};
    call.mockResolvedValueOnce(JSON.stringify({slot_evidence:[old],should_finish:false})).mockResolvedValueOnce(JSON.stringify({slot_evidence:[fresh],should_finish:false}));
    expect((await director(f.snapshot,f.state,nextProbe(d,f.state),messages)).slot_evidence[0].message_id).toBe("latest");
    const input=JSON.parse(call.mock.calls[0][0].userPrompt);expect(input.latest_candidate_message_id).toBe("latest");expect(input.coverage[slot.slot_id].sufficient).toBe(true);expect(JSON.stringify(input.coverage)).not.toContain("已保存历史片段");
    expect(JSON.parse(call.mock.calls[1][0].userPrompt).repair.validation_error).toContain("不重复输出");
    delete f.snapshot.model.director.evidence_scope;call.mockResolvedValueOnce(JSON.stringify({slot_evidence:[old],should_finish:false}));
    expect((await director(f.snapshot,f.state,nextProbe(d,f.state),messages)).slot_evidence[0].message_id).toBe("old");
  });
  it("retains all sixteen distinct observations when one new reply actually supplies them",async()=>{
    const f=fixture();f.snapshot.prompts.director=f.snapshot.prompts.judge;const d=f.snapshot.definition;
    for(const fact of [...d.public_facts,...Object.values(d.role_facts).flat(),...d.events.flatMap(e=>e.facts)])f.state.released_facts[fact.id]="facts";
    const quotes=d.slots.map((s,i)=>`本轮具体行为${i}：依据已知权限作出相应安排。`);
    const messages=[{id:"facts",senderType:"agent",senderName:"系统",content:"已发送事实和事件",roundIndex:0},{id:"latest",senderType:"user",senderName:"候选人",content:quotes.join("\n"),roundIndex:15}];
    call.mockResolvedValue(JSON.stringify({next_probe:{agent:"leader",slot_ids:[]},should_finish:true,slot_evidence:d.slots.map((s,i)=>({slot_id:s.slot_id,message_id:"latest",quote:quotes[i],sufficiency:"sufficient",valence:"support",reason:"具体行为"}))}));
    expect((await director(f.snapshot,f.state,nextProbe(d,f.state),messages)).slot_evidence).toHaveLength(16);
    expect(call.mock.calls[0][0].maxTokens).toBe(6000);expect(call.mock.calls[0][0].maxAttempts).toBe(1);
  });
});
