import type { Definition, Ge8State, TranscriptMessage } from "./types";

export const usesResponseQuality = (d:Definition)=>d.scoring_policy.evidence_policy==="response-quality/1";
export interface AnsweredOpportunity { question_message_id:string; response_message_id:string }

/** Only an actually delivered, neutral question followed by a candidate response counts.
 * These links establish observation conditions, never an automatic score or negative judgment. */
export function answeredOpportunities(slotId:string,d:Definition,state:Ge8State,messages:TranscriptMessage[]):AnsweredOpportunity[] {
  const slot=d.slots.find(s=>s.slot_id===slotId);if(!slot)return [];
  const links:AnsweredOpportunity[]=[];
  for(const o of state.slots[slotId]?.opportunities??[]) {
    const qi=messages.findIndex(m=>m.id===o.question_message_id && m.senderType==="agent" && m.content.includes(slot.probe_intent));
    if(qi<0)continue;
    const response=messages.slice(qi+1).find(m=>m.senderType==="user" || m.senderType==="system");
    if(!response || response.senderType!=="user" || !response.content.trim() || /__ASSESSMENT_TIME_EXPIRED__/.test(response.content))continue;
    const ri=messages.indexOf(response);
    if(slot.required_fact_ids.some(f=>!messages.slice(0,ri).some(m=>m.id===state.released_facts[f] && m.senderType==="agent")))continue;
    if(!links.some(l=>l.question_message_id===o.question_message_id))links.push({question_message_id:o.question_message_id,response_message_id:response.id});
  }
  return links;
}
