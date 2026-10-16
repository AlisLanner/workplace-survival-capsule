import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db/prisma";
import { BUNDLE, definitions, getDefinition, hash, PROMPT_NAMES, VERSION } from "./definitions";
import type { Definition } from "./types";
import type { Prisma, Scenario } from "@prisma/client";
import fingerprints from "./legacy-fingerprints.json";

const fields=["title","description","backgroundForUser","openingMessageJson","initialBlackboardJson","maxRound","groupChatEnabled","groupChatRounds","status"] as const;
export const installationId=`${VERSION}/install-1`;
export function definitionConfig(d:Definition) {
  return {title:d.title,description:`${d.scenario_code} · 统一八维 · ${d.user_role}`,backgroundForUser:[`你是${d.user_role}。`,...d.public_facts.map(f=>f.text),"这是模拟任务设定，请说明你的判断及理由。"].join("\n\n"),assessmentVersion:d.assessment_version,assessmentDefinitionJson:JSON.stringify(d),maxRound:d.round_policy.max};
}
async function compatible(tx:Prisma.TransactionClient,row:Scenario|null) {
  if(!row)return true;
  if(!row.assessmentVersion)return hash(Object.fromEntries(fields.map(k=>[k,row[k]])))===(fingerprints as Record<string,string>)[row.id];
  let old:Definition;try{old=getDefinition(row.id,row.assessmentVersion);}catch{return false;}
  if(Object.entries(definitionConfig(old)).some(([k,v])=>row[k as keyof Scenario]!==v))return false;
  const archive=await tx.assessmentInstallation.findUnique({where:{id:`legacy-scenario/${row.id}`}});
  if(archive){const source=JSON.parse(archive.manifestJson);if(["groupChatEnabled","groupChatRounds","openingMessageJson","initialBlackboardJson"].some(k=>row[k as keyof Scenario]!==source[k]))return false;}
  return true;
}
export async function installGe8(apply=false) {
  const templates=PROMPT_NAMES.map(name=>({key:`${BUNDLE}/${name}`,name:`${name} ${BUNDLE}`,content:fs.readFileSync(path.resolve(__dirname,`../prompts/ge8/${name}.prompt.txt`),"utf8")}));
  const manifest={installation_id:installationId,definition_hash:hash(definitions),templates:templates.map(t=>({key:t.key,hash:hash(t.content)})),scenarios:definitions.map(d=>({id:d.scenario_id,version:d.assessment_version,hash:hash(d)}))};
  const existing=await prisma.assessmentInstallation.findUnique({where:{id:installationId}});
  if(existing){
    const saved=JSON.parse(existing.manifestJson);
    if(Object.entries(manifest).some(([k,v])=>hash(saved[k])!==hash(v)))throw new Error("安装ID已存在但内容不同：须升版本");
    for(const t of templates){const row=await prisma.promptTemplate.findUnique({where:{key:t.key}});if(row?.content!==t.content)throw new Error(`已安装源模板被修改：${t.key}`);}
    for(const d of definitions){const row=await prisma.scenario.findUnique({where:{id:d.scenario_id}});if(!row || !await compatible(prisma,row))throw new Error(`已安装情境被修改：${d.scenario_id}`);}
    return {...saved,already_installed:true,applied:false};
  }
  const conflicts:string[]=[];
  const changes:Array<{id:string;from_version:string|null;from_hash:string;to_hash:string}>=[];
  for(const d of definitions) {
    const row=await prisma.scenario.findUnique({where:{id:d.scenario_id}});
    if(!await compatible(prisma,row))conflicts.push(`情境有自定义修改，保留原值并停止安装：${d.scenario_id}`);
    changes.push({id:d.scenario_id,from_version:row?.assessmentVersion??null,from_hash:hash(row),to_hash:hash(definitionConfig(d))});
  }
  for(const t of templates){const row=await prisma.promptTemplate.findUnique({where:{key:t.key}});if(row && row.content!==t.content)conflicts.push(`版本模板冲突：${t.key}`);}
  if(conflicts.length)throw new Error(conflicts.join("\n"));
  if(!apply)return {...manifest,changes,applied:false,dry_run:true};
  await prisma.$transaction(async tx=>{
    // Recheck in the write transaction so a simultaneous admin edit is never overwritten.
    for(const change of changes){const row=await tx.scenario.findUnique({where:{id:change.id}});if(hash(row)!==change.from_hash || !await compatible(tx,row))throw new Error(`安装期间情境发生变化：${change.id}`);}
    for(const t of templates){const row=await tx.promptTemplate.findUnique({where:{key:t.key}});if(row && row.content!==t.content)throw new Error(`安装期间模板发生变化：${t.key}`);await tx.promptTemplate.upsert({where:{key:t.key},create:t,update:{}});}
    await tx.promptBundle.create({data:{id:BUNDLE,keysJson:JSON.stringify(Object.fromEntries(PROMPT_NAMES.map(n=>[n,`${BUNDLE}/${n}`])))}});
    for(const d of definitions) {
      const legacy=await tx.scenario.findUnique({where:{id:d.scenario_id}});
      if(legacy)await tx.assessmentInstallation.upsert({where:{id:legacy.assessmentVersion?`scenario-config/${legacy.assessmentVersion}/${d.scenario_id}`:`legacy-scenario/${d.scenario_id}`},create:{id:legacy.assessmentVersion?`scenario-config/${legacy.assessmentVersion}/${d.scenario_id}`:`legacy-scenario/${d.scenario_id}`,manifestJson:JSON.stringify(legacy)},update:{}});
      const config=definitionConfig(d);
      await tx.scenario.upsert({where:{id:d.scenario_id},create:{id:d.scenario_id,...config},update:config});
    }
    await tx.assessmentInstallation.create({data:{id:installationId,manifestJson:JSON.stringify({...manifest,changes})}});
  });
  return {...manifest,changes,applied:true};
}
if(require.main===module)installGe8(process.argv.includes("--apply")).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
