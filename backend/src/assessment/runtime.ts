import { execFileSync } from "node:child_process";
import { prisma } from "../db/prisma";
import type { Prisma } from "@prisma/client";
import { BUNDLE, hash, PROMPT_NAMES, SCHEMA } from "./definitions";
import type { Definition, ModelConfig, Snapshot } from "./types";
import type { Scenario } from "@prisma/client";

export function frozenScenario(scenario:Scenario,raw:string|null):Scenario {
  const s=readSnapshot(raw);const d=s.definition;
  return {...scenario,title:d.title,description:`${d.scenario_code} · 统一八维 · ${d.user_role}`,backgroundForUser:[`你是${d.user_role}。`,...d.public_facts.map(f=>f.text),"这是模拟任务设定，请说明你的判断及理由。"].join("\n\n"),assessmentVersion:d.assessment_version,maxRound:d.round_policy.max,openingMessageJson:null,initialBlackboardJson:null,assessmentDefinitionJson:null,
    ...(s.runtime?{groupChatEnabled:s.runtime.group_chat_enabled,groupChatRounds:JSON.stringify(s.runtime.group_chat_rounds)}:{})};
}

export function modelConfig():ModelConfig {
  const fast=process.env.DEEPSEEK_FAST_MODEL||"deepseek-v4-flash";
  return {mock:process.env.USE_MOCK_LLM==="true",base_url:process.env.DEEPSEEK_BASE_URL||"https://api.deepseek.com",fast_model:fast,judge_model:process.env.DEEPSEEK_JUDGE_MODEL||process.env.DEEPSEEK_FAST_MODEL||process.env.DEEPSEEK_STRONG_MODEL||fast,
    director:{temperature:0.15,max_tokens:2200,timeout_ms:90000,thinking:false},
    npc:{temperature:0.65,max_tokens:900,timeout_ms:90000,thinking:false},
    guard:{temperature:0.1,max_tokens:1800,timeout_ms:90000,thinking:false},
    judge:{temperature:0.1,max_tokens:30000,timeout_ms:240000,thinking:true},max_attempts:2};
}
export function sealSnapshot(snapshot:Snapshot):Snapshot {
  const {snapshot_hash:_,...body}=snapshot;
  return {...body,snapshot_format:"ge8-snapshot/2",snapshot_hash:hash({...body,snapshot_format:"ge8-snapshot/2"})};
}
export async function createSnapshot(tx:Prisma.TransactionClient,definition:Definition,runtime:NonNullable<Snapshot["runtime"]>):Promise<Snapshot> {
  const bundle=await tx.promptBundle.findFirst({where:{active:true,id:{startsWith:definition.assessment_version+"/"}},orderBy:[{createdAt:"desc"},{id:"desc"}]});
  if(!bundle)throw new Error(`新版模板未安装：${definition.prompt_bundle_version||BUNDLE}`);
  const keys=JSON.parse(bundle.keysJson) as Record<string,string>;
  const prompts:Snapshot["prompts"]={};
  for(const name of PROMPT_NAMES) {
    const p=await tx.promptTemplate.findUnique({where:{key:keys[name]??""}});
    if(!p?.active || !p.content.trim())throw new Error(`冻结模板不可用：${name}`);
    prompts[name]={key:p.key,content:p.content,hash:hash(p.content)};
  }
  const model=modelConfig();
  if(!model.mock && !process.env.DEEPSEEK_API_KEY)throw new Error("真实模式未配置API key；请在本机配置，不会自动降级为mock。");
  let code="unknown";let dirty=true;
  try{code=execFileSync("git",["rev-parse","HEAD"],{cwd:process.cwd(),encoding:"utf8",windowsHide:true}).trim();dirty=!!execFileSync("git",["status","--porcelain"],{cwd:process.cwd(),encoding:"utf8",windowsHide:true}).trim();}catch{}
  return sealSnapshot({schema_version:SCHEMA,definition:{...definition,prompt_bundle_version:bundle.id},definition_hash:hash({...definition,prompt_bundle_version:bundle.id}),code_sha:code,code_dirty:dirty,prompts,prompt_bundle_hash:hash(prompts),model,runtime});
}
export function readSnapshot(raw:string|null):Snapshot {
  if(!raw)throw new Error("新版会话缺少快照，停止续测以免混用定义");
  const s=JSON.parse(raw) as Snapshot;
  if(s.schema_version!==SCHEMA || hash(s.definition)!==s.definition_hash || hash(s.prompts)!==s.prompt_bundle_hash || Object.values(s.prompts).some(p=>hash(p.content)!==p.hash))throw new Error("会话快照版本或哈希不匹配");
  if(s.snapshot_format==="ge8-snapshot/2") {
    const {snapshot_hash,...body}=s;
    if(!snapshot_hash || snapshot_hash!==hash(body) || !s.runtime)throw new Error("完整会话快照校验失败，停止续测");
  } else if(s.definition.assessment_version!=="ge8-20261016.2")throw new Error("新版会话缺少完整配置快照");
  return s;
}
export function publicMeta(s:Snapshot) {
  return {snapshot_hash:s.snapshot_hash,definition_hash:s.definition_hash,prompt_bundle_version:s.definition.prompt_bundle_version,prompt_bundle_hash:s.prompt_bundle_hash,prompt_hashes:Object.fromEntries(Object.entries(s.prompts).map(([k,v])=>[k,v.hash])),code_sha:s.code_sha,code_dirty:s.code_dirty??false,model:s.model,mode:s.model.mock?"mock":"real"};
}
