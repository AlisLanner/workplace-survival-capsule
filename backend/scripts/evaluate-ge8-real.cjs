// Explicit real evaluation; all outputs must remain outside the public repository. Never reruns a saved case.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..');const [directory,database,phase,sceneCodes]=process.argv.slice(2);
if(!directory||!database||!['probes','fixed','e2e'].includes(phase)||!/^verification-real-.*\.db$/.test(path.basename(database)))throw Error('Usage: evaluate-ge8-real.cjs private-output-dir verification-real-*.db probes|fixed|e2e');
if(sceneCodes && (phase==='fixed'||! /^(A|B|C|E)(,(A|B|C|E))*$/.test(sceneCodes)))throw Error('Optional scene filter is A,B,C,E and applies only to probes/e2e.');
const out=path.resolve(directory);const relative=path.relative(repo,out);if(!relative.startsWith('..')||path.isAbsolute(relative))throw Error('Evaluation logs must be outside the public repository.');
if(cp.execFileSync('git',['-C',repo,'status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit reviewed code before freezing an evaluation batch.');
fs.mkdirSync(out,{recursive:true});
const {server,prisma}=require(path.join(repo,'scripts/local-server.cjs')).startLocal({port:0,database,mode:'real'});
const get=n=>require(path.join(repo,'backend/dist/src',n));
const {definitions,hash}=get('assessment/definitions.js'),{createSnapshot}=get('assessment/runtime.js'),{evaluationFixture}=get('assessment/evaluation.js'),{judge}=get('assessment/judge.js'),{callContext}=get('assessment/audit.js'),{calibration}=get('assessment/calibration.js');
const selectedDefinitions=definitions.filter(d=>!sceneCodes||sceneCodes.split(',').includes(d.scenario_code));
const write=(name,x)=>{const target=path.join(out,name+'.json');fs.writeFileSync(target+'.tmp',JSON.stringify(x,null,2));fs.renameSync(target+'.tmp',target);};
const read=name=>fs.existsSync(path.join(out,name+'.json'))?JSON.parse(fs.readFileSync(path.join(out,name+'.json'),'utf8')):null;
let base;
async function api(route,data,stream=false){const r=await fetch(base+'/api/'+route,data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const text=await r.text();if(!r.ok)throw Error('HTTP '+r.status+': '+text);if(!stream)return JSON.parse(text);if(!text.includes('event: done')){write('sse-failure',{route,session_id:data?.session_id,text});throw Error('SSE did not finish; inspect saved sse-failure.json');}assert(!text.includes('assessmentSnapshotJson'));assert(!text.includes('anchors'));return JSON.parse(text.split('event: done\ndata: ')[1].split('\n\n')[0]);}
async function freeze(){
 let bank=read('frozen-bank');if(bank){assert.equal(bank.definition_hash,hash(definitions),'Do not mix changed definitions into an existing batch');assert.equal(bank.code_sha,cp.execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'Start a new batch after code changes');return bank;}
 const cases=[];
 for(const d of definitions)for(const kind of ['high','low','missing'])cases.push(evaluationFixture(d,kind));
 bank={frozen_at:new Date().toISOString(),code_sha:cp.execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),definition_hash:hash(definitions),cases,
   interpretation:'Synthetic rubric-consistency checks, not independent validity evidence.',stopping_rule:'Stop on a technical or opportunity blocker; bounded two attempts per lane; no automatic rerun of saved cases.',
   direction_rule:'high and low: all eight rated; high mean >=11, low mean <=8; paired high mean exceeds low by >=4; missing: all scores null; no exact score targets.'};
 bank.bank_hash=hash(bank);write('frozen-bank',bank);return bank;
}
async function summary(){
 const calls=await prisma.assessmentCallAudit.findMany({orderBy:[{createdAt:'asc'},{id:'asc'}]});
 const tokens={prompt_tokens:0,completion_tokens:0,total_tokens:0};let unknown=0,repairs=0;const first=new Map();
 for(const c of calls){
  const key=c.runId+':'+c.kind.replace(/^(judge\/\d+)\/\d+$/,'$1');if(first.has(key))repairs++;else first.set(key,c);
  const u=c.usageJson?JSON.parse(c.usageJson):null;if(!u||typeof u!=='object'){unknown++;continue;}
  for(const k of Object.keys(tokens))if(typeof u[k]==='number')tokens[k]+=u[k];
 }
 const initial=[...first.values()];
 write('usage',{requests:calls.length,request_failures:calls.filter(c=>c.error).length,http_or_transport_failures:calls.filter(c=>c.error&&!c.responseJson).length,validation_failures:calls.filter(c=>c.error&&c.responseJson).length,
  repair_requests:repairs,first_answer_groups:initial.length,valid_first_answers:initial.filter(c=>!c.error).length,first_answer_valid_rate:initial.length?initial.filter(c=>!c.error).length/initial.length:null,
  unknown_usage_requests:unknown,tokens,cost:'Unknown: no verified unit pricing assumed',by_kind:calls.reduce((x,c)=>(x[c.kind]=(x[c.kind]||0)+1,x),{})});
}
async function main(){
 await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;const bank=await freeze();write(phase+'-scope',{scene_codes:selectedDefinitions.map(d=>d.scenario_code),code_sha:bank.code_sha});
 if(phase==='probes')for(const d of selectedDefinitions){const name='probe-'+d.scenario_code;const prior=read(name);if(prior){if(prior.state!=='completed')throw Error('Review interrupted probe: '+name);continue;}const start=await api('assessment/start',{scenario_id:d.scenario_id,nickname:'真实链路探测（合成）'});write(name,{state:'started',session_id:start.session_id});const result=await api('assessment/message',{session_id:start.session_id,content:calibration[d.scenario_code][0].high.join('\n')});assert.equal(result.reply.speaker,d.roles[JSON.parse((await prisma.assessmentSession.findUnique({where:{id:start.session_id}})).blackboardState).last_agent].name);assert.equal(await prisma.agentTraceEvent.count({where:{sessionId:start.session_id,nodeId:'npcSafeProbe'}}),0,'Review role failures before running the full batch');write(name,{state:'completed',session_id:start.session_id,result});console.log('PROBE_OK='+d.scenario_code);}
 if(phase==='fixed'){
  for(const fixture of bank.cases){const name='fixed-'+fixture.id;const prior=read(name);if(prior){if(prior.state!=='completed')throw Error('Previous case requires review: '+name);continue;}
   const d=definitions.find(d=>d.scenario_code===fixture.id.split('-')[0]);const run=process.pid+':'+crypto.randomUUID();
   const session=await prisma.$transaction(async tx=>{const scenario=await tx.scenario.findUniqueOrThrow({where:{id:d.scenario_id}});const snapshot=await createSnapshot(tx,d,{group_chat_enabled:scenario.groupChatEnabled,group_chat_rounds:JSON.parse(scenario.groupChatRounds)});assert(!snapshot.model.mock);const row=await tx.assessmentSession.create({data:{scenarioId:d.scenario_id,assessmentVersion:d.assessment_version,assessmentSnapshotJson:JSON.stringify(snapshot),blackboardState:JSON.stringify(fixture.state),status:'scoring',scoringRunId:run,scoringAttempts:1,round:fixture.state.round}});for(const m of fixture.messages)await tx.message.create({data:{...m,sessionId:row.id}});return {...row,snapshot};});
   write(name,{state:'started',session_id:session.id,fixture_hash:fixture.fixture_hash});
   const report=await callContext.run({sessionId:session.id,runId:run,assessmentVersion:d.assessment_version},()=>judge(session.snapshot,fixture.state,fixture.messages));
   await prisma.assessmentSession.update({where:{id:session.id},data:{status:'finished',reportJson:JSON.stringify(report),totalScore:report.report_status==='confident'?report.total_score:null,endedAt:new Date()}});
   const scores=report.dimension_results.map(r=>r.score),mean=scores.every(n=>n!==null)?scores.reduce((a,b)=>a+b,0)/8:null;
   const passed=report.report_status!=='scoring_failed' && (fixture.kind==='missing'?scores.every(s=>s===null):scores.every(s=>s!==null)&&(fixture.kind==='high'?mean>=11:mean<=8));
   write(name,{state:passed?'completed':'blocked',session_id:session.id,fixture_hash:fixture.fixture_hash,mean,passed,report});await summary();console.log('FIXED_RESULT='+fixture.id+' '+JSON.stringify({passed,mean,status:report.report_status,attempts:report.sampling_stats.attempts}));if(!passed)throw Error('Frozen evaluation case blocked: '+fixture.id);
  }
  const pairs=definitions.map(d=>{const high=read('fixed-'+d.scenario_code+'-high').mean,low=read('fixed-'+d.scenario_code+'-low').mean;return {scene:d.scenario_code,high,low,passed:high-low>=4};});write('paired-direction',{pairs,passed:pairs.every(p=>p.passed)});assert(pairs.every(p=>p.passed));
 }
 if(phase==='e2e')for(const d of selectedDefinitions){const name='e2e-'+d.scenario_code;const prior=read(name);if(prior){if(prior.state!=='completed')throw Error('Review interrupted e2e before any paid restart: '+name);continue;}const start=await api('assessment/start',{scenario_id:d.scenario_id,nickname:'真实整链路（合成）'});write(name,{state:'started',session_id:start.session_id});const turns=[];let result;
  for(let i=1;i<=15;i++){const row=await prisma.assessmentSession.findUnique({where:{id:start.session_id}});const state=JSON.parse(row.blackboardState);const ids=state.pending_probe?.slot_ids??[];const content=ids.map(id=>{const index=d.slots.findIndex(s=>s.slot_id===id);return calibration[d.scenario_code][Math.floor(index/2)].high[index%2];}).join('\n')||'我继续按已经确认的安排推进；仍需核实的内容不作保证。';result=await api('assessment/message/stream',{session_id:start.session_id,content},true);turns.push({round:i,content,result});write(name,{state:'running',session_id:start.session_id,turns});if(result.finished)break;}
  const row=await prisma.assessmentSession.findUnique({where:{id:start.session_id}}),state=JSON.parse(row.blackboardState);const messages=await prisma.message.findMany({where:{sessionId:row.id},orderBy:[{roundIndex:'asc'},{createdAt:'asc'}]});
  const eventChecks=d.events.map(e=>{const m=messages.find(m=>m.id===state.released_events[e.id]);return {event:e.id,passed:!!m&&m.senderName===d.roles[e.agent].name&&m.content.includes(e.facts[0].text)&&m.roundIndex===e.round};});
  let last,consecutive=0,max=0;for(const m of messages.filter(m=>m.senderType==='agent')){consecutive=last===m.senderName?consecutive+1:1;last=m.senderName;max=Math.max(max,consecutive);}
  const audit=await prisma.assessmentCallAudit.findMany({where:{sessionId:row.id}});const passed=result?.finished&&result.report.report_status!=='scoring_failed'&&result.report.dimension_results.every(r=>r.score!==null)&&eventChecks.every(e=>e.passed)&&max<=2&&row.scoringAttempts===1;
  write(name,{state:passed?'completed':'blocked',session_id:row.id,passed,eventChecks,max_consecutive_agent:max,model_requests:audit.length,technical_npc_fallbacks:await prisma.agentTraceEvent.count({where:{sessionId:row.id,nodeId:'npcSafeProbe'}}),turns,messages,report:result?.report});await summary();console.log('E2E_RESULT='+d.scenario_code+' '+JSON.stringify({passed,rounds:turns.length,requests:audit.length}));if(!passed)throw Error('E2E blocker in '+d.scenario_code);
 }
 await summary();console.log('PHASE_COMPLETED='+phase);
}
main().catch(e=>{write('last-error',{phase,time:new Date().toISOString(),error:String(e.message).replaceAll(process.env.DEEPSEEK_API_KEY||'\0','[REDACTED]')});console.error('EVALUATION_STOPPED='+e.message);process.exitCode=1;}).finally(async()=>{await summary();server.closeAllConnections();server.close(()=>prisma.$disconnect());});
