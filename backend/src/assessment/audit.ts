import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prisma } from "../db/prisma";
import { callDeepSeek } from "../services/llm.service";
import { hash, VERSION } from "./definitions";
// Capture the loaded process once; an old session's starting snapshot remains unchanged after a code upgrade.
export const executionIdentity=(()=>{
  let code_sha="unknown",code_dirty=true;
  try{code_sha=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8",windowsHide:true}).trim();code_dirty=!!execFileSync("git",["status","--porcelain"],{encoding:"utf8",windowsHide:true}).trim();}catch{}
  const extension=__filename.endsWith(".ts")?".ts":".js";
  const module_hashes=Object.fromEntries(["audit","agents","judge","session","evidenceProtocol","evidenceProtocolV1","coverage","responseQuality"].map(name=>{try{return [name,hash(fs.readFileSync(path.join(__dirname,name+extension),"utf8"))];}catch{return [name,"unknown"];}}));
  return {code_sha,code_dirty,module_hashes};
})();
export const callContext=new AsyncLocalStorage<{sessionId:string;runId:string;assessmentVersion?:string}>();
export async function auditedCall<T=string>(kind:string,params:Parameters<typeof callDeepSeek>[0],validate?:(response:string)=>T):Promise<T> {
  const context=callContext.getStore();
  // Request content contains frozen prompts and input; no credentials are passed in params.
  const request={...params,mockMode:false,onUsage:undefined,execution:executionIdentity};
  const row=context?await prisma.assessmentCallAudit.create({data:{sessionId:context.sessionId,runId:context.runId,kind,assessmentVersion:context.assessmentVersion??VERSION,requestHash:hash(request),requestJson:JSON.stringify(request)}}):null;
  let usage:unknown=null;
  try {
    const response=await callDeepSeek({...params,mockMode:false,onUsage:u=>{usage=u;}});
    if(row)await prisma.assessmentCallAudit.update({where:{id:row.id},data:{responseJson:response,usageJson:JSON.stringify(usage??"unknown")}});
    return validate?validate(response):response as T;
  }catch(error) {
    if(row)await prisma.assessmentCallAudit.update({where:{id:row.id},data:{error:error instanceof Error?error.message:String(error),usageJson:JSON.stringify(usage??"unknown")}});
    throw error;
  }
}
