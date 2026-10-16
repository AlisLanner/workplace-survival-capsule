import {describe,it,expect,vi,afterEach} from "vitest";
import {definitions,getDefinition,hash} from "../src/assessment/definitions";
import {delivered,initialState,nextProbe} from "../src/assessment/coverage";
import {frozenScenario,modelConfig,readSnapshot,sealSnapshot} from "../src/assessment/runtime";
import {evaluationFixture} from "../src/assessment/evaluation";
import {canonicalPrompt} from "../src/assessment/install";

describe("versioned content and full configuration freeze",()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it("installs identical template hashes from Windows and LF checkouts",()=>{expect(hash(canonicalPrompt("角色\r\n问题\r\n"))).toBe(hash(canonicalPrompt("角色\n问题\n")));});
  it.each(definitions)("rotates roles through fixed events and exhausted slots: $scenario_code",d=>{
    for(const exhausted of [false,true]){
      const state=initialState(d);
      if(exhausted)for(const slot of Object.values(state.slots))slot.evidence=[{sufficiency:"sufficient"} as any];
      delivered({agent:"leader",slot_ids:[],questions:[],facts:d.public_facts,event_ids:[]},"opening",0,state,d);
      for(let round=1;round<=15;round++){state.round=round;const p=nextProbe(d,state,{agent:state.last_agent!,slot_ids:d.slots.map(s=>s.slot_id)});delivered(p,`q${round}`,round,state,d);expect(state.consecutive_agent).toBeLessThanOrEqual(2);}
      for(const event of d.events)expect(Number(state.released_events[event.id].slice(1))).toBe(event.round);
    }
  });
  it("keeps v2 definitions addressable after upgrading new starts",()=>{
    for(const d of definitions){const old=getDefinition(d.scenario_id,"ge8-20261016.2");expect(old.slots.every(s=>s.slot_id.startsWith("ge8-20261016.2:"))).toBe(true);expect(old.anchors[0]).not.toEqual(d.anchors[0]);}
  });
  it("rejects corruption in model, runtime, code or prompt mapping, while retaining frozen public facts",()=>{
    const d=definitions[0];const s=sealSnapshot({schema_version:d.schema_version,definition:d,definition_hash:hash(d),code_sha:"frozen",prompts:{},prompt_bundle_hash:hash({}),model:modelConfig(),runtime:{group_chat_enabled:true,group_chat_rounds:[3,6]}});
    expect(readSnapshot(JSON.stringify(s)).snapshot_hash).toBe(s.snapshot_hash);
    for(const mutate of [(x:any)=>x.model.fast_model="other",(x:any)=>x.runtime.group_chat_enabled=false,(x:any)=>x.code_sha="new",(x:any)=>x.model.mock=!x.model.mock]){const x=structuredClone(s);mutate(x);expect(()=>readSnapshot(JSON.stringify(x))).toThrow();}
    vi.stubEnv("DEEPSEEK_FAST_MODEL","different");
    const scenario=frozenScenario({title:"changed",backgroundForUser:"changed",groupChatRounds:"[]"} as any,JSON.stringify(s));
    expect(scenario.title).toBe(d.title);expect(scenario.backgroundForUser).toContain(d.public_facts[0].text);expect(scenario.groupChatRounds).toBe("[3,6]");expect(readSnapshot(JSON.stringify(s)).model.fast_model).toBe(s.model.fast_model);
  });
  it("retains only the explicitly archived unsealed format, rejects unsealed new versions",()=>{
    for(const version of ["ge8-20261016.2",definitions[0].assessment_version]){
      const d=getDefinition(definitions[0].scenario_id,version);const s={schema_version:d.schema_version,definition:d,definition_hash:hash(d),code_sha:"old",prompts:{},prompt_bundle_hash:hash({}),model:modelConfig()};
      if(version.endsWith(".2"))expect(()=>readSnapshot(JSON.stringify(s))).not.toThrow();else expect(()=>readSnapshot(JSON.stringify(s))).toThrow();
    }
  });
  it.each(definitions)("freezes separate high, counter and verbose missing transcripts: $scenario_code",d=>{
    const fixtures=(["high","low","missing"] as const).map(k=>evaluationFixture(d,k));
    expect(new Set(fixtures.map(f=>f.fixture_hash)).size).toBe(3);
    for(const f of fixtures){expect(Object.values(f.state.slots).every(s=>s.opportunities.length===1 && !s.evidence.length)).toBe(true);expect(f.messages.filter(m=>m.senderType==="user")).toHaveLength(8);}
  });
});
