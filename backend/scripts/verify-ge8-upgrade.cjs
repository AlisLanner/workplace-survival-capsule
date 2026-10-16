// Disposable v2 database only: upgrade preservation, conflicts, concurrency, crash recovery and frozen calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const repo=path.resolve(__dirname,'../..');const [output,database]=process.argv.slice(2);
if(!output||!database||!/^verification-.*\.db$/.test(path.basename(database)))throw Error('Use output.json and an explicit disposable verification-*.db');
const {server,prisma}=require(path.join(repo,'scripts/local-server.cjs')).startLocal({port:0,database,mode:'mock'});
const get=n=>require(path.join(repo,'backend/dist/src',n));
const {definitions,BUNDLE,hash}=get('assessment/definitions.js');const {installGe8}=get('assessment/install.js');
const {startGe8,runGe8,retryScoring,recoverInterruptedTurn}=get('assessment/session.js');const {sealSnapshot}=get('assessment/runtime.js');
const {startAssessment,sendAssessmentMessage,getAssessmentSession}=get('services/assessment.service.js');
const {createInitialBlackboard}=get('services/blackboard.service.js');
const checks=[];let provider;
async function main(){
 await new Promise(r=>server.once('listening',r));
 const rows=await prisma.scenario.findMany();assert.equal(rows.filter(s=>s.assessmentVersion==='ge8-20261016.2').length,4);
 const v2=[];const legacy=[];
 for(const d of definitions){
  const s=await startGe8(d.scenario_id,{});v2.push(await prisma.assessmentSession.findUnique({where:{id:s.session_id}}));
  const archive=JSON.parse((await prisma.assessmentInstallation.findUnique({where:{id:'legacy-scenario/'+d.scenario_id}})).manifestJson);
  const s0=await prisma.assessmentSession.create({data:{scenarioId:d.scenario_id,blackboardState:JSON.stringify(createInitialBlackboard(archive.maxRound,d.scenario_id))}});
  const opening=JSON.parse(archive.openingMessageJson);await prisma.message.create({data:{sessionId:s0.id,senderType:'agent',senderName:opening.speaker,senderRole:opening.role,content:opening.content,roundIndex:0}});legacy.push(s0.id);
 }
 const beforeCount=await prisma.promptBundle.count();const original=rows.find(s=>s.id===definitions[0].scenario_id);
 await prisma.scenario.update({where:{id:original.id},data:{title:'synthetic custom scenario'}});
 await assert.rejects(installGe8(true),/自定义修改/);assert.equal(await prisma.promptBundle.count(),beforeCount);
 assert.equal((await prisma.scenario.findUnique({where:{id:original.id}})).title,'synthetic custom scenario');
 await prisma.scenario.update({where:{id:original.id},data:{title:original.title}});checks.push('custom scenario conflict refuses all writes and retains custom value');
 const t=await prisma.promptTemplate.create({data:{key:BUNDLE+'/director',name:'synthetic conflict',content:'synthetic custom prompt'}});
 await assert.rejects(installGe8(true),/模板冲突/);assert.equal(await prisma.promptBundle.count(),beforeCount);await prisma.promptTemplate.delete({where:{id:t.id}});checks.push('custom target prompt conflict refuses all writes');
 const preview=await installGe8(false);assert.equal(preview.changes.length,4);assert(preview.changes.every(c=>c.from_version==='ge8-20261016.2'));
 await installGe8(true);assert.equal((await installGe8(true)).already_installed,true);
 for(const row of v2){assert.equal((await prisma.assessmentSession.findUnique({where:{id:row.id}})).assessmentSnapshotJson,row.assessmentSnapshotJson);const view=await getAssessmentSession(row.id);assert.equal(view.scenario.assessmentVersion,'ge8-20261016.2');await runGe8(row.id,'请继续核对未知，并说明需要我决定的事项。');}
 checks.push('known v2 upgrade is previewed and idempotent; four in-flight v2 snapshots and routes remain usable');
 for(const id of legacy){const result=await sendAssessmentMessage(id,'先核实已知事实和关键未知，明确我能承担的事情，再请有权限的人确认。');assert(!result.blackboard.assessment_version);const view=await getAssessmentSession(id);assert.equal(view.scenario.assessmentVersion,null);assert(!view.scenario.backgroundForUser.includes('这是模拟任务设定'));}
 checks.push('four in-flight unversioned A/B/C/E retain their original tasks after upgrade');
 const started=await startGe8(original.id,{});const outcomes=await Promise.allSettled([runGe8(started.session_id,'__ASSESSMENT_TIME_EXPIRED__'),runGe8(started.session_id,'__ASSESSMENT_TIME_EXPIRED__')]);
 assert(outcomes.some(r=>r.status==='fulfilled'));const finished=await prisma.assessmentSession.findUnique({where:{id:started.session_id}});assert.equal(finished.scoringAttempts,1);assert.equal(finished.status,'finished');assert.equal(await prisma.message.count({where:{sessionId:finished.id,senderType:'system'}}),1);
 await runGe8(finished.id,'再次结束');assert.equal((await prisma.assessmentSession.findUnique({where:{id:finished.id}})).scoringAttempts,1);checks.push('simultaneous finish and repeated request save one user turn and one scoring run');
 const lock=await startGe8(original.id,{});await prisma.assessmentSession.update({where:{id:lock.session_id},data:{turnLockId:process.pid+':alive',turnLockedAt:new Date()}});
 await assert.rejects(recoverInterruptedTurn(lock.session_id),/仍存在或状态未知/);
 await prisma.assessmentSession.update({where:{id:lock.session_id},data:{turnLockId:'2147483647:dead'}});const n=await prisma.assessmentCallAudit.count();assert.equal((await recoverInterruptedTurn(lock.session_id)).model_calls,0);assert.equal(await prisma.assessmentCallAudit.count(),n);await assert.rejects(recoverInterruptedTurn(lock.session_id),/没有可恢复/);checks.push('only dead-owner turn locks can be explicitly recovered, without model calls');
 const scoring=await startGe8(original.id,{});await prisma.assessmentSession.update({where:{id:scoring.session_id},data:{status:'scoring',scoringRunId:process.pid+':alive',scoringAttempts:1}});await assert.rejects(retryScoring(scoring.session_id),/仍存在/);
 await prisma.assessmentSession.update({where:{id:scoring.session_id},data:{scoringRunId:'2147483647:dead'}});await retryScoring(scoring.session_id);await assert.rejects(retryScoring(scoring.session_id),/上限/);assert.equal((await prisma.assessmentSession.findUnique({where:{id:scoring.session_id}})).scoringAttempts,2);checks.push('dead-owner scoring recovery is explicit and bounded at one additional five-lane run');
 // A local HTTP provider exercises actual request serialization and guard correction, without external API costs.
 const requests=[];
 provider=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;const x=JSON.parse(body);requests.push(x);const input=JSON.parse(x.messages[1].content);let result;
  if(input.draft)result={no_change:false,issues:['synthetic guard conflict']};
  else if(input.role_profile)result={visible_reply:{speaker:input.role_profile.name,role:input.role_profile.role,content:'稍后再讨论这些事情。'}};
  else result={slot_evidence:[],should_finish:false};
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));
 });await new Promise(r=>provider.listen(0,'127.0.0.1',r));
 const frozen=await startGe8(original.id,{});const row=await prisma.assessmentSession.findUnique({where:{id:frozen.session_id}});const snapshot=JSON.parse(row.assessmentSnapshotJson);
 snapshot.model.mock=false;snapshot.model.base_url='http://127.0.0.1:'+provider.address().port;snapshot.runtime={group_chat_enabled:true,group_chat_rounds:[1]};
 await prisma.assessmentSession.update({where:{id:row.id},data:{assessmentSnapshotJson:JSON.stringify(sealSnapshot(snapshot))}});
 const savedScenario=await prisma.scenario.findUnique({where:{id:original.id}});await prisma.scenario.update({where:{id:original.id},data:{title:'later edit',backgroundForUser:'later facts',groupChatEnabled:false,groupChatRounds:'[]'}});
 process.env.DEEPSEEK_FAST_MODEL='later-model';process.env.USE_MOCK_LLM='true';process.env.DEEPSEEK_API_KEY='synthetic-test-only';
 const reply=await runGe8(row.id,'先说明哪些事已确认。');assert(!reply.reply.content.includes('稍后再讨论'));assert.equal(requests.length,3);assert(requests.every(x=>x.model===snapshot.model.fast_model));
 const discussion=await prisma.agentGroupDiscussion.findFirst({where:{sessionId:row.id}});assert.equal(JSON.parse(discussion.outputJson).correction_applied,true);assert(JSON.parse(discussion.inputJson).draft.content.includes('稍后再讨论'));
 const audits=await prisma.assessmentCallAudit.findMany({where:{sessionId:row.id}});assert.equal(audits.length,3);assert(audits.every(a=>JSON.parse(a.requestJson).mockMode===false));
 const view=await getAssessmentSession(row.id);assert.equal(view.scenario.title,original.title);assert(!view.scenario.backgroundForUser.includes('later facts'));assert.equal(view.group_discussions.length,0);assert(!JSON.stringify(view).includes('draft'));
 await prisma.scenario.update({where:{id:original.id},data:{title:savedScenario.title,backgroundForUser:savedScenario.backgroundForUser,groupChatEnabled:savedScenario.groupChatEnabled,groupChatRounds:savedScenario.groupChatRounds}});
 checks.push('frozen model, mode, facts and guard schedule survive live edits; guard checks the draft and corrects the actual reply; candidate sees no private discussion');
 fs.writeFileSync(output,JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{provider?.closeAllConnections();provider?.close();server.closeAllConnections();server.close(()=>prisma.$disconnect());});
