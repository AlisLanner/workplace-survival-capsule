import { hash } from "./definitions";
import { opportunityFor } from "./coverage";
import type { Definition, DimensionResult, Evidence, Ge8State, SlotResult, TranscriptMessage, Valence } from "./types";

// Immutable protocol revision: changing segmentation or wire semantics requires another revision.
export const EVIDENCE_PROTOCOL="ge8-evidence-ranges/1" as const;
export const EVIDENCE_PROTOCOL_SPEC={id:EVIDENCE_PROTOCOL,max_segment_units:80,delimiters:"。；！？!?\n，,;：:",wire:"evaluations:[[dimension_id,score,analysis,[point1_evidence,point2_evidence]]]",evidence:"[first_segment_id,last_segment_id,sufficiency,valence,reason]",derivation:"point sufficiency/valence and dimension names/status from verified evidence and frozen definition"};
export const EVIDENCE_PROTOCOL_HASH=hash(EVIDENCE_PROTOCOL_SPEC);
export const requiresEvidenceRanges=(version:string)=>version==="ge8-20261016.10";
interface Segment {id:string;message_id:string;start:number;end:number;quote:string}
export interface CandidateCatalog {messages:unknown[];segments:Map<string,Segment>;hash:string}
export class EvidenceProtocolError extends Error {
  constructor(readonly issues:string[]){super(issues.join("\n"));this.name="EvidenceProtocolError";}
}
export function candidateCatalog(messages:TranscriptMessage[]):CandidateCatalog {
  if(new Set(messages.map(m=>m.id)).size!==messages.length)throw new Error("对话消息ID重复，无法生成可靠的原文索引");
  const segments=new Map<string,Segment>();let user=0;
  const transcript=messages.map(m=>{
    if(m.senderType!=="user" || /__ASSESSMENT_TIME_EXPIRED__/.test(m.content))return m;
    user++;const parts:[string,string][]=[];let start=0,index=0;
    for(let end=1;end<=m.content.length;end++) {
      const ch=m.content[end-1];
      if((end===m.content.length || EVIDENCE_PROTOCOL_SPEC.delimiters.includes(ch) || end-start>=80) && !(/[\uD800-\uDBFF]/.test(ch) && /[\uDC00-\uDFFF]/.test(m.content[end]??""))) {
        const id=`U${user}.${++index}`,quote=m.content.slice(start,end);
        segments.set(id,{id,message_id:m.id,start,end,quote});parts.push([id,quote]);start=end;
      }
    }
    const {content,...metadata}=m;
    return {...metadata,candidate_segments:parts};
  });
  return {messages:transcript,segments,hash:hash([...segments.values()])};
}
function direction(evidence:Evidence[]):Valence|null {
  if(!evidence.length)return null;
  const values=new Set(evidence.map(e=>e.valence));
  return values.size>1 || values.has("mixed")?"mixed":evidence[0].valence;
}
/** Expand only server-issued ranges; no model-authored quote, message ID or offset is accepted. */
export function decodeJudgeRanges(input:unknown,d:Definition,state:Ge8State,catalog:CandidateCatalog):{dimension_results:DimensionResult[]} {
  const root=input as {evaluations?:unknown[]};
  if(!root || typeof root!=="object" || Array.isArray(root) || Object.keys(root).length!==1 || !Array.isArray(root.evaluations) || root.evaluations.length!==8)throw new EvidenceProtocolError(["只允许evaluations字段，必须有GE01—GE08共8项"]);
  const errors:string[]=[];
  const dimensions=root.evaluations.map((raw,i):DimensionResult=>{
    const def=d.dimensions[i],points=d.slots.filter(s=>s.dimension_id===def.id);
    try {
      if(!Array.isArray(raw) || raw.length!==4 || raw[0]!==def.id || (raw[1]!==null && (!Number.isInteger(raw[1]) || raw[1]<0 || raw[1]>20)) || typeof raw[2]!=="string" || !raw[2].trim() || !Array.isArray(raw[3]) || raw[3].length!==2)throw Error("必须为[正确维度ID,0—20整数或null,分析,两个观察点的证据数组]，不可增删或错序");
      const slots=raw[3].map((entries:unknown,j:number):SlotResult=>{
        const slot=points[j];
        if(!Array.isArray(entries))throw Error(`${slot.display_code}证据必须为数组；没有可判断片段时为[]`);
        const evidence=entries.map((tuple:unknown):Evidence=>{
          if(!Array.isArray(tuple) || tuple.length!==5 || typeof tuple[0]!=="string" || typeof tuple[1]!=="string" || !["partial","sufficient"].includes(tuple[2]) || !["support","counter","mixed"].includes(tuple[3]) || typeof tuple[4]!=="string" || !tuple[4].trim())throw Error(`${slot.display_code}证据必须为[起段ID,止段ID,partial或sufficient,方向,理由]`);
          const first=catalog.segments.get(tuple[0]),last=catalog.segments.get(tuple[1]);
          if(!first || !last || first.message_id!==last.message_id || first.start>last.start)throw Error(`${slot.display_code}原文范围无效：${tuple[0]}至${tuple[1]}；只能选同一候选人消息中已提供且顺序正确的片段ID`);
          // Segment coordinates come only from the original message, never the model.
          const quote=[...catalog.segments.values()].filter(s=>s.message_id===first.message_id && s.start>=first.start && s.end<=last.end).map(s=>s.quote).join("");
          return {slot_id:slot.slot_id,message_id:first.message_id,quote,start:first.start,end:last.end,sufficiency:tuple[2],valence:tuple[3],reason:tuple[4]};
        });
        return {slot_id:slot.slot_id,opportunity:evidence.length?opportunityFor(slot.slot_id,state,d):(state.slots[slot.slot_id]?.opportunities??[]),sufficiency:evidence.some(e=>e.sufficiency==="sufficient")?"sufficient":evidence.length?"partial":"none",valence:direction(evidence),evidence};
      });
      return {id:def.id,name:def.name,score:raw[1],analysis:raw[2],status:raw[1]!==null?"rated":slots.every(s=>s.opportunity.length)?"insufficient":"not_observed",slot_results:slots};
    }catch(error){errors.push(`${def.id}: ${error instanceof Error?error.message:String(error)}`);return {} as DimensionResult;}
  });
  if(errors.length)throw new EvidenceProtocolError(errors);
  return {dimension_results:dimensions};
}
