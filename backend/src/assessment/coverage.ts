import type { Definition, Evidence, Ge8State, Probe, TranscriptMessage, Opportunity } from "./types";

export function initialState(d:Definition):Ge8State {
  return {schema_version:d.schema_version,assessment_version:d.assessment_version,scenario_id:d.scenario_id,round:0,min_round:d.round_policy.min,max_round:d.round_policy.max,phase:"assessment",released_facts:{},released_events:{},slots:Object.fromEntries(d.slots.map(s=>[s.slot_id,{opportunities:[],evidence:[]}])),consecutive_agent:0};
}
export function locateEvidence(e:Evidence,d:Definition,state:Ge8State,messages:TranscriptMessage[]):Evidence {
  const slot=d.slots.find(s=>s.slot_id===e.slot_id);
  const index=messages.findIndex(m=>m.id===e.message_id && m.senderType==="user");
  const msg=messages[index];
  if(!slot || !msg || !e.quote?.trim() || /__ASSESSMENT_TIME_EXPIRED__/.test(msg.content))throw new Error("证据槽位或候选人消息无效");
  const start=msg.content.indexOf(e.quote);
  if(start<0 || !["none","partial","sufficient"].includes(e.sufficiency) || !["support","counter","mixed"].includes(e.valence) || !e.reason?.trim())throw new Error("引文或证据状态无效");
  if(slot.required_fact_ids.some(f=>{const id=state.released_facts[f];return !id || !messages.slice(0,index).some(m=>m.id===id && m.senderType==="agent");}))throw new Error("必要事实尚未送达该回应前");
  return {...e,start,end:start+e.quote.length};
}
export function opportunityFor(slotId:string,state:Ge8State,d:Definition):Opportunity[] {
  const stored=state.slots[slotId]?.opportunities??[];
  if(stored.length)return stored;
  const slot=d.slots.find(s=>s.slot_id===slotId)!;
  if(slot.required_fact_ids.some(f=>!state.released_facts[f]))return [];
  return [{question_message_id:state.released_facts[slot.required_fact_ids[0]],fact_ids:slot.required_fact_ids,round:state.round}];
}
export function recordEvidence(input:unknown,d:Definition,state:Ge8State,messages:TranscriptMessage[]):string[] {
  const errors:string[]=[];
  if(!Array.isArray(input))return ["slot_evidence must be an array"];
  for(const raw of input) {
    try {const e=locateEvidence(raw,d,state,messages);if(e.sufficiency==="none")continue;const s=state.slots[e.slot_id];if(!s.evidence.some(x=>x.message_id===e.message_id && x.quote===e.quote && x.sufficiency===e.sufficiency))s.evidence.push(e);}
    catch(e){errors.push(e instanceof Error?e.message:String(e));}
  }
  return errors;
}
export function coverage(d:Definition,state:Ge8State) {
  const covered=d.dimensions.filter(dim=>d.slots.filter(s=>s.dimension_id===dim.id).every(s=>state.slots[s.slot_id].evidence.some(e=>e.sufficiency==="sufficient") && opportunityFor(s.slot_id,state,d).length>0)).map(x=>x.name);
  return {covered_dimensions:covered,insufficient_dimensions:d.dimensions.filter(x=>!covered.includes(x.name)).map(x=>x.name),complete:covered.length===8};
}
/** Deterministic facts and deadlines; models may never invent events or expand authority. */
export function nextProbe(d:Definition,state:Ge8State,suggestion?:{agent:string;slot_ids:string[]}):Probe {
  const limit=d.round_policy.max_consecutive_agent_rounds??2;
  const blocked=new Set<string>();
  if(state.last_agent && state.consecutive_agent>=limit)blocked.add(state.last_agent);
  // Reserve a turn before a fixed event, so its role can speak on schedule without a third consecutive reply.
  if(state.last_agent && state.consecutive_agent>=limit-1 && d.events.some(e=>e.round===state.round+1 && e.agent===state.last_agent && !state.released_events[e.id]))blocked.add(state.last_agent);
  const due=d.events.find(e=>e.round<=state.round && !state.released_events[e.id] && !blocked.has(e.agent));
  const factsReady=(s:Definition["slots"][number])=>s.required_fact_ids.every(f=>state.released_facts[f] || due?.facts.some(x=>x.id===f));
  const pending=d.slots.filter(s=>factsReady(s) && !state.slots[s.slot_id].evidence.some(e=>e.sufficiency==="sufficient"));
  pending.sort((a,b)=>Number(state.slots[a.slot_id].opportunities.length>0)-Number(state.slots[b.slot_id].opportunities.length>0) || b.priority-a.priority || a.slot_id.localeCompare(b.slot_id));
  const options=pending.filter(s=>!blocked.has(s.target_agent));
  const proposed=options.filter(s=>s.target_agent===suggestion?.agent && suggestion.slot_ids.includes(s.slot_id));
  const agent=due?.agent ?? proposed[0]?.target_agent ?? options[0]?.target_agent ?? (["leader","coworker","client"] as const).find(a=>!blocked.has(a))!;
  const selected=(!due && proposed.length?proposed:pending.filter(s=>s.target_agent===agent)).slice(0,2);
  return {agent,slot_ids:selected.map(s=>s.slot_id),questions:selected.map(s=>s.probe_intent),facts:[...d.role_facts[agent].filter(f=>!state.released_facts[f.id]),...(due?.facts??[])],event_ids:due?[due.id]:[]};
}
export function delivered(probe:Probe,messageId:string,round:number,state:Ge8State,d:Definition) {
  for(const f of probe.facts)state.released_facts[f.id]=messageId;
  for(const id of probe.event_ids)state.released_events[id]=messageId;
  for(const id of probe.slot_ids)state.slots[id].opportunities.push({question_message_id:messageId,fact_ids:d.slots.find(s=>s.slot_id===id)!.required_fact_ids.filter(f=>!!state.released_facts[f]),event_id:probe.event_ids[0],round});
  state.consecutive_agent=state.last_agent===probe.agent?state.consecutive_agent+1:1;state.last_agent=probe.agent;
}
export function publicState(state:Ge8State) {
  return {schema_version:state.schema_version,assessment_version:state.assessment_version,scenario_id:state.scenario_id,round:state.round,min_round:state.min_round,max_round:state.max_round,phase:state.phase};
}
export function agentView(kind:string,d:Definition,state:Ge8State,probe:Probe,messages:TranscriptMessage[]) {
  const released=[...d.public_facts,...Object.values(d.role_facts).flat(),...d.events.flatMap(e=>e.facts)].filter(f=>state.released_facts[f.id]);
  if(kind==="npc")return {scenario_id:d.scenario_id,role_profile:d.roles[probe.agent],user_role:d.user_role,known_facts:[...released,...d.role_facts[probe.agent]],probe:{questions:probe.questions,facts:probe.facts},messages};
  if(kind==="guard")return {scenario_id:d.scenario_id,roles:d.roles,released_facts:released,probe,messages};
  return {scenario_id:d.scenario_id,round:state.round,min_round:state.min_round,max_round:state.max_round,roles:d.roles,released_facts:released,slots:d.slots.map(({observation,priority,...s})=>s),coverage:state.slots,next_probe:probe,messages};
}
