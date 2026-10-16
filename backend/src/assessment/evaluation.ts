/** Frozen, authored engineering fixtures. These reuse rubric examples for a consistency check;
 * they are not independent expert ratings or evidence of psychometric validity. */
import { calibration } from "./calibration";
import { delivered, initialState } from "./coverage";
import { usesResponseQuality } from "./responseQuality";
import { hash } from "./definitions";
import type { Definition, Probe, TranscriptMessage } from "./types";

export type EvaluationKind="high"|"low"|"missing"|"vague"|"partial";
export function evaluationFixture(d:Definition,kind:EvaluationKind,prefix=`${d.scenario_code}-${kind}`) {
  const state=initialState(d);const messages:TranscriptMessage[]=[];
  const add=(senderType:string,senderName:string,content:string)=>{
    const m={id:`${prefix}-${messages.length}`,senderType,senderName,content,roundIndex:state.round};messages.push(m);return m;
  };
  // Facts are delivered by the appropriate role before any scored reply, including both fixed events.
  for(const agent of ["leader","coworker","client"] as const){
    const facts=[...(agent==="leader"?d.public_facts:[]),...d.role_facts[agent]];
    const m=add("agent",d.roles[agent].name,facts.map(f=>f.text).join("\n"));
    delivered({agent,slot_ids:[],questions:[],facts,event_ids:[]},m.id,state.round,state,d);
  }
  for(const event of d.events){state.round=event.round;const m=add("agent",d.roles[event.agent].name,event.facts.map(f=>f.text).join("\n"));delivered({agent:event.agent,slot_ids:[],questions:[],facts:event.facts,event_ids:[event.id]},m.id,state.round,state,d);}
  for(let i=0;i<8;i++){
    state.round++;
    const slots=d.slots.filter(s=>s.dimension_id===d.dimensions[i].id);
    for(const slot of slots){const probe:Probe={agent:slot.target_agent,slot_ids:[slot.slot_id],questions:[slot.probe_intent],facts:[],event_ids:[]};const m=add("agent",d.roles[probe.agent].name,slot.probe_intent);delivered(probe,m.id,state.round,state,d);}
    if(kind!=="missing" || !usesResponseQuality(d))add("user","候选人",kind==="vague" || kind==="missing"?"我知道了。我会重视这些事情，认真努力，做好各方面的工作。":calibration[d.scenario_code][i][kind==="partial"?"middle":kind].join("\n"));
  }
  if(kind==="missing" && usesResponseQuality(d))add("system","计时系统","__ASSESSMENT_TIME_EXPIRED__");
  return {id:prefix,kind,definition_hash:hash(d),state,messages,
    expected:kind==="vague"?"明确中性提问后只给相关态度但没有具体行动；应依据逐点问题和实际回应形成受限表现评分，不能一律null或直接补0。":kind==="partial"?"已有主要行动但关键依据、条件或执行细节不足；按6—15的适用分档评分，不能要求全部细节齐全才给分。":kind==="high"?"八维均有充分具体原话，整体方向应高于明确不当案例；不要求逐分命中。":kind==="low"?"八维均有可定位明确反向行为，充分负向证据可评分，不当行为应低于高质量案例。":(usesResponseQuality(d)?"问题已送达但没有候选人回应，计时结束；八维保留null，不能把缺失当低分。":"已提供机会但回答不可判断，八维应保留null，不把空话变成0。"),
    fixture_hash:hash({definition_hash:hash(d),kind,messages})};
}
