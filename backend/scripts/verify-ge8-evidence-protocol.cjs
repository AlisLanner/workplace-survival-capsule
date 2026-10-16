// Four-scene HTTP fault injection. Synthetic messages, loopback provider, no external model calls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),[output,database]=process.argv.slice(2);
if(!output||!database||!/^verification-.*\.db$/.test(path.basename(database)))throw Error('Use private output.json and disposable verification-*.db');
const {server,prisma}=require(path.join(repo,'scripts/local-server.cjs')).startLocal({port:0,database,mode:'mock'});
const get=n=>require(path.join(repo,'backend/dist/src/assessment',n+'.js'));
const {definitions}=get('definitions'),{startGe8,retryScoring}=get('session'),{sealSnapshot}=get('runtime'),{candidateCatalog}=get('evidenceProtocol'),{aggregateSamples,validateSample}=get('judge');
let provider,requests=0;const checks=[],samples=new Map(),firstByScene=new Map();
async function main(){
 await new Promise(r=>server.once('listening',r));
 provider=http.createServer(async(req,res)=>{try{
  let body='';for await(const c of req)body+=c;const request=JSON.parse(body),input=JSON.parse(request.messages[1].content);requests++;
  assert.equal(input.evidence_protocol,'ge8-evidence-ranges/2');assert(input.candidate_catalog_hash);assert(input.messages.filter(m=>m.senderType==='user').every(m=>!('content' in m)&&Array.isArray(m.candidate_segments)));
  let sample=structuredClone(samples.get(input.definition.scenario_id)),raw;
  if(input.repair){assert(input.repair.previous_response);assert(input.repair.validation_issues.length);assert(!input.repair.candidate_source_fragments);raw=JSON.stringify(sample);}
  else {
   const n=firstByScene.get(input.definition.scenario_id)||0;firstByScene.set(input.definition.scenario_id,n+1);
   if(n===0)raw='{"scores":[],"scores":'+JSON.stringify(sample.scores)+',"evidence":'+JSON.stringify(sample.evidence)+'}';
   else {sample.evidence[0][1]='NPC-or-other-session';raw=JSON.stringify(sample);}
  }
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:raw}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));
 }catch(e){res.statusCode=500;res.end(e.message);}});
 await new Promise(r=>provider.listen(0,'127.0.0.1',r));process.env.DEEPSEEK_API_KEY='synthetic-loopback-only';
 for(const d of definitions){
  const start=await startGe8(d.scenario_id,{}),s=await prisma.assessmentSession.findUniqueOrThrow({where:{id:start.session_id}}),state=JSON.parse(s.blackboardState),snapshot=JSON.parse(s.assessmentSnapshotJson);
  snapshot.model.mock=false;snapshot.model.base_url='http://127.0.0.1:'+provider.address().port;assert.equal(snapshot.model.judge.output_protocol,'ge8-evidence-ranges/2');
  const facts=await prisma.message.create({data:{sessionId:s.id,senderType:'agent',senderName:'系统',content:'合成任务事实与观察机会已提供',roundIndex:0}});
  for(const f of [...d.public_facts,...Object.values(d.role_facts).flat(),...d.events.flatMap(e=>e.facts)])state.released_facts[f.id]=facts.id;
  for(const slot of d.slots)state.slots[slot.slot_id].opportunities=[{question_message_id:facts.id,fact_ids:slot.required_fact_ids,round:0}];
  const quotes=d.slots.map((_,i)=>`第${i+1}项合成行为：先核对条件，再说明本人的具体行动。`);
  const user=await prisma.message.create({data:{sessionId:s.id,senderType:'user',senderName:'候选人',content:quotes.join('\n'),roundIndex:15}});
  const messages=await prisma.message.findMany({where:{sessionId:s.id},orderBy:[{roundIndex:'asc'},{createdAt:'asc'}]}),segments=[...candidateCatalog(messages).segments.values()];
  const refs=quotes.map(q=>{const start=user.content.indexOf(q),end=start+q.length;return [segments.find(s=>s.start===start).id,segments.find(s=>s.end===end).id,'sufficient','support','对应独立行为'];});
  samples.set(d.scenario_id,{scores:d.dimensions.map(dim=>[dim.id,14,'两个点的共同分档依据']),evidence:d.slots.map((slot,i)=>[slot.display_code,...refs[i]])});
  state.round=15;state.phase='finished';const snapshotRaw=JSON.stringify(sealSnapshot(snapshot)),previous=aggregateSamples([],snapshot,state);
  await prisma.assessmentSession.update({where:{id:s.id},data:{status:'finished',round:15,assessmentSnapshotJson:snapshotRaw,blackboardState:JSON.stringify(state),reportJson:JSON.stringify(previous),scoringRunId:'2147483647:previous',scoringAttempts:1}});
  const outcomes=await Promise.allSettled([retryScoring(s.id),retryScoring(s.id)]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  const after=await prisma.assessmentSession.findUniqueOrThrow({where:{id:s.id}}),report=JSON.parse(after.reportJson);assert.equal(report.sampling_stats.valid_sample_count,5);assert.equal(report.report_status,'confident');assert.equal(after.scoringAttempts,2);assert.equal(after.assessmentSnapshotJson,snapshotRaw);assert.equal(after.round,15);
  validateSample({dimension_results:report.dimension_results},d,state,messages);assert.deepEqual(await prisma.message.findMany({where:{sessionId:s.id},orderBy:[{roundIndex:'asc'},{createdAt:'asc'}]}),messages);
  const history=await prisma.agentTraceEvent.findMany({where:{sessionId:s.id,nodeId:'scoringRetry'}});assert.equal(history.length,1);assert.deepEqual(JSON.parse(history[0].payloadJson).previous_report,previous);
  const audits=await prisma.assessmentCallAudit.findMany({where:{sessionId:s.id}});assert.equal(audits.length,10);assert.equal(audits.filter(a=>a.error).length,5);assert(audits.every(a=>a.responseJson));
  const count=requests;await assert.rejects(retryScoring(s.id),/上限/);const view=await fetch('http://127.0.0.1:'+server.address().port+'/api/assessment/session/'+s.id);assert.equal(view.status,200);const text=await view.text();assert(!text.includes('candidate_segments'));assert(!text.includes('assessmentSnapshotJson'));assert.equal(requests,count);
  checks.push(d.scenario_code+': reference-only HTTP wire, invalid references/duplicate keys rejected, bounded repair, exact final citations, preserved snapshot/answers/report, one retry owner, GET/exhausted retry free');
 }
 const result={passed:true,external_requests:0,loopback_requests:requests,checks};fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{provider?.closeAllConnections();provider?.close();server.closeAllConnections();server.close(()=>prisma.$disconnect());});
