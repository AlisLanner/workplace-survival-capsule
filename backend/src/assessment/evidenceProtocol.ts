import { hash } from "./definitions";
import { opportunityFor } from "./coverage";
import * as v1 from "./evidenceProtocolV1";
import type { Definition, DimensionResult, Evidence, Ge8State, SlotResult, Valence } from "./types";
export { candidateCatalog, EvidenceProtocolError } from "./evidenceProtocolV1";
export type { CandidateCatalog } from "./evidenceProtocolV1";

export const EVIDENCE_PROTOCOL="ge8-evidence-ranges/2" as const;
export const EVIDENCE_PROTOCOL_SPEC={id:EVIDENCE_PROTOCOL,segmentation_hash:v1.EVIDENCE_PROTOCOL_HASH,wire:"scores:[[dimension_id,score,analysis]];evidence:[[point_code,first_segment_id,last_segment_id,sufficiency,valence,reason]]",derivation:"fixed sixteen points; sufficiency and valence derived once from grouped evidence; no automatic scoring of missing points"};
export const EVIDENCE_PROTOCOL_HASH=hash(EVIDENCE_PROTOCOL_SPEC);
export function protocolForVersion(version:string){return version==="ge8-20261016.10"?v1.EVIDENCE_PROTOCOL:["ge8-20261016.11","ge8-20261016.12"].includes(version)?EVIDENCE_PROTOCOL:undefined;}
export function evidenceProtocolHash(protocol:string){if(protocol===v1.EVIDENCE_PROTOCOL)return v1.EVIDENCE_PROTOCOL_HASH;if(protocol===EVIDENCE_PROTOCOL)return EVIDENCE_PROTOCOL_HASH;throw new Error("未知评分引用协议");}
export const requiresEvidenceRanges=(version:string)=>protocolForVersion(version)!==undefined;
/** Both revisions use the immutable v1 segmentation. Their wire decoders remain separate. */
export function decodeJudgeRanges(input:unknown,d:Definition,state:Ge8State,catalog:v1.CandidateCatalog,protocol:string=EVIDENCE_PROTOCOL):{dimension_results:DimensionResult[]} {
  if(protocol===v1.EVIDENCE_PROTOCOL)return v1.decodeJudgeRanges(input,d,state,catalog);
  if(protocol!==EVIDENCE_PROTOCOL)throw new Error("未知评分引用协议");
  const root=input as {scores?:unknown[];evidence?:unknown[]};
  if(!root || typeof root!=="object" || Array.isArray(root) || Object.keys(root).sort().join(",")!=="evidence,scores" || !Array.isArray(root.scores) || root.scores.length!==8 || !Array.isArray(root.evidence))throw new v1.EvidenceProtocolError(["只允许scores和evidence两字段；scores按GE01—GE08恰好8行，evidence为平面证据行数组"]);
  const errors:string[]=[],grouped=new Map(d.slots.map(s=>[s.display_code,{slot:s,evidence:[] as Evidence[]}])) ,seen=new Set<string>();
  root.evidence.forEach((raw,i)=>{
    try {
      if(!Array.isArray(raw) || raw.length!==6 || typeof raw[0]!=="string" || typeof raw[1]!=="string" || typeof raw[2]!=="string" || !["partial","sufficient"].includes(raw[3]) || !["support","counter","mixed"].includes(raw[4]) || typeof raw[5]!=="string" || !raw[5].trim())throw Error("必须为[观察点代码,起段ID,止段ID,partial或sufficient,方向,理由]，每行固定6项");
      const point=grouped.get(raw[0]),first=catalog.segments.get(raw[1]),last=catalog.segments.get(raw[2]);
      if(!point)throw Error(`未知观察点代码${raw[0]}，只能使用definition.slots中的display_code`);
      if(!first || !last || first.message_id!==last.message_id || first.start>last.start)throw Error(`原文范围无效${raw[1]}至${raw[2]}；只能选同一候选人消息中已提供且顺序正确的片段ID`);
      const quote=[...catalog.segments.values()].filter(s=>s.message_id===first.message_id && s.start>=first.start && s.end<=last.end).map(s=>s.quote).join("");
      const key=JSON.stringify([point.slot.slot_id,first.message_id,quote]);if(seen.has(key))throw Error("同一观察点的同一原文范围重复，不能重复计算证据");seen.add(key);
      point.evidence.push({slot_id:point.slot.slot_id,message_id:first.message_id,quote,start:first.start,end:last.end,sufficiency:raw[3],valence:raw[4],reason:raw[5]});
    }catch(error){errors.push(`evidence[${i}]: ${error instanceof Error?error.message:String(error)}`);}
  });
  const dimensions=root.scores.map((raw,i):DimensionResult=>{
    const def=d.dimensions[i];
    try {
      if(!Array.isArray(raw) || raw.length!==3 || raw[0]!==def.id || (raw[1]!==null && (!Number.isInteger(raw[1]) || raw[1]<0 || raw[1]>20)) || typeof raw[2]!=="string" || !raw[2].trim())throw Error("必须为[正确维度ID,0—20整数或null,分析]，每行固定3项，八维不可增删、重复或错序");
      const slots=d.slots.filter(s=>s.dimension_id===def.id).map((slot):SlotResult=>{
        const evidence=grouped.get(slot.display_code)!.evidence,values=new Set(evidence.map(e=>e.valence));
        const valence:Valence|null=!evidence.length?null:values.size>1 || values.has("mixed")?"mixed":evidence[0].valence;
        return {slot_id:slot.slot_id,opportunity:evidence.length?opportunityFor(slot.slot_id,state,d):(state.slots[slot.slot_id]?.opportunities??[]),sufficiency:evidence.some(e=>e.sufficiency==="sufficient")?"sufficient":evidence.length?"partial":"none",valence,evidence};
      });
      return {id:def.id,name:def.name,score:raw[1],analysis:raw[2],status:raw[1]!==null?"rated":slots.every(s=>s.opportunity.length)?"insufficient":"not_observed",slot_results:slots};
    }catch(error){errors.push(`${def.id}: ${error instanceof Error?error.message:String(error)}`);return {} as DimensionResult;}
  });
  if(errors.length)throw new v1.EvidenceProtocolError(errors);
  return {dimension_results:dimensions};
}
