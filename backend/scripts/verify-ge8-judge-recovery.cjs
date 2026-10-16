// Installed v9 disposable copy only (v10 uses verify-ge8-evidence-protocol.cjs). Synthetic loopback: complete repair diagnostics, report history and retry ownership.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),[output,database]=process.argv.slice(2);
if(!output||!database||!/^verification-.*\.db$/.test(path.basename(database)))throw Error('Use output.json and a disposable verification-*.db');
const {server,prisma}=require(path.join(repo,'scripts/local-server.cjs')).startLocal({port:0,database,mode:'mock'});
const get=n=>require(path.join(repo,'backend/dist/src/assessment',n+'.js'));
const {definitions}=get('definitions'),{startGe8,retryScoring}=get('session'),{sealSnapshot}=get('runtime');
const {recordEvidence}=get('coverage'),{aggregateSamples,mockSample}=get('judge');
let provider,requests=0;const checks=[],valid=new Map();
async function main(){
 await new Promise(r=>server.once('listening',r));
 provider=http.createServer(async(req,res)=>{try{
  let body='';for await(const c of req)body+=c;const request=JSON.parse(body),input=JSON.parse(request.messages[1].content);requests++;
  let sample=structuredClone(valid.get(input.definition.scenario_id));
  if(input.repair){
   const issues=input.repair.validation_issues.join('\n');assert(issues.includes('跨维重复取证'));assert(issues.includes('充分性冲突'));assert(issues.includes('引文不存在'));
   assert(input.repair.previous_response.includes('改写后不存在'));assert(input.repair.candidate_source_fragments.every(s=>input.messages.find(m=>m.id===s.message_id).senderType==='user'));
  }else{
   const first=sample.dimension_results[0].slot_results[0].evidence[0],second=sample.dimension_results[1].slot_results[0];second.evidence=[{...first,slot_id:second.slot_id}];
   sample.dimension_results[2].slot_results[0].sufficiency='partial';sample.dimension_results[7].slot_results[1].evidence[0].quote='改写后不存在';
  }
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(sample)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));
 }catch(e){res.statusCode=500;res.end(e.message);}});
 await new Promise(r=>provider.listen(0,'127.0.0.1',r));process.env.DEEPSEEK_API_KEY='synthetic-loopback-only';
 for(const current of definitions){
  const start=await startGe8(current.scenario_id,{}),s=await prisma.assessmentSession.findUniqueOrThrow({where:{id:start.session_id}}),state=JSON.parse(s.blackboardState),snapshot=JSON.parse(s.assessmentSnapshotJson);
  assert.equal(snapshot.definition.assessment_version,"ge8-20261016.9","Use an installed v9 copy for legacy protocol verification");const d=snapshot.definition;
  snapshot.model.mock=false;snapshot.model.base_url='http://127.0.0.1:'+provider.address().port;
  const facts=await prisma.message.create({data:{sessionId:s.id,senderType:'agent',senderName:'系统',content:'合成任务事实均已送达',roundIndex:0}});
  for(const f of [...d.public_facts,...Object.values(d.role_facts).flat(),...d.events.flatMap(e=>e.facts)])state.released_facts[f.id]=facts.id;
  const quotes=d.slots.map((_,i)=>`第${i+1}项合成行为：先核对条件，再说明本人的具体行动。`);
  const user=await prisma.message.create({data:{sessionId:s.id,senderType:'user',senderName:'候选人',content:quotes.join('\n'),roundIndex:15}});
  const messages=await prisma.message.findMany({where:{sessionId:s.id},orderBy:[{roundIndex:'asc'},{createdAt:'asc'}]});
  assert.deepEqual(recordEvidence(d.slots.map((slot,i)=>({slot_id:slot.slot_id,message_id:user.id,quote:quotes[i],sufficiency:'sufficient',valence:'support',reason:'合成独立行为'})),d,state,messages),[]);
  state.round=15;state.phase='finished';valid.set(d.scenario_id,mockSample(snapshot,state));
  const rawSnapshot=JSON.stringify(sealSnapshot(snapshot)),previous=aggregateSamples([],snapshot,state);
  await prisma.assessmentSession.update({where:{id:s.id},data:{status:'finished',round:15,assessmentSnapshotJson:rawSnapshot,blackboardState:JSON.stringify(state),reportJson:JSON.stringify(previous),scoringRunId:'2147483647:original',scoringAttempts:1}});
  const outcomes=await Promise.allSettled([retryScoring(s.id),retryScoring(s.id)]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  const after=await prisma.assessmentSession.findUniqueOrThrow({where:{id:s.id}}),report=JSON.parse(after.reportJson);
  assert.equal(report.sampling_stats.valid_sample_count,5);assert.equal(report.report_status,'confident');assert.equal(after.scoringAttempts,2);assert.equal(after.round,15);assert.equal(after.assessmentSnapshotJson,rawSnapshot);
  assert.deepEqual(await prisma.message.findMany({where:{sessionId:s.id},orderBy:[{roundIndex:'asc'},{createdAt:'asc'}]}),messages);
  const history=await prisma.agentTraceEvent.findMany({where:{sessionId:s.id,nodeId:'scoringRetry'}});assert.equal(history.length,1);assert.deepEqual(JSON.parse(history[0].payloadJson).previous_report,previous);
  const audits=await prisma.assessmentCallAudit.findMany({where:{sessionId:s.id}});assert.equal(audits.length,10);assert.equal(audits.filter(a=>a.error).length,5);assert(audits.every(a=>a.responseJson));
  const count=requests;await assert.rejects(retryScoring(s.id),/上限/);
  const view=await fetch('http://127.0.0.1:'+server.address().port+'/api/assessment/session/'+s.id);assert.equal(view.status,200);const text=await view.text();assert(!text.includes('assessmentSnapshotJson'));assert(!text.includes('candidate_source_fragments'));assert.equal(requests,count);
  checks.push(d.scenario_code+': one retry owner, five valid lanes, original report/answers/snapshot retained, GET and exhausted retry make no calls');
 }
 const result={passed:true,checks,external_requests:0,loopback_requests:requests};fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{provider?.closeAllConnections();provider?.close();server.closeAllConnections();server.close(()=>prisma.$disconnect());});
