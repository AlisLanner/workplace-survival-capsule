import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "../db/prisma";
import { callDeepSeek } from "../services/llm.service";
import { hash, VERSION } from "./definitions";
export const callContext=new AsyncLocalStorage<{sessionId:string;runId:string;assessmentVersion?:string}>();
export async function auditedCall(kind:string,params:Parameters<typeof callDeepSeek>[0]) {
  const context=callContext.getStore();
  // Request content contains frozen prompts and input; no credentials are passed in params.
  const request={...params,mockMode:false,onUsage:undefined};
  const row=context?await prisma.assessmentCallAudit.create({data:{sessionId:context.sessionId,runId:context.runId,kind,assessmentVersion:context.assessmentVersion??VERSION,requestHash:hash(request),requestJson:JSON.stringify(request)}}):null;
  let usage:unknown=null;
  try {
    const response=await callDeepSeek({...params,mockMode:false,onUsage:u=>{usage=u;}});
    if(row)await prisma.assessmentCallAudit.update({where:{id:row.id},data:{responseJson:response,usageJson:JSON.stringify(usage??"unknown")}});
    return response;
  }catch(error) {
    if(row)await prisma.assessmentCallAudit.update({where:{id:row.id},data:{error:error instanceof Error?error.message:String(error),usageJson:JSON.stringify(usage??"unknown")}});
    throw error;
  }
}
