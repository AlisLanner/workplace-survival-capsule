// Full streamed workflow against a local deterministic provider. No external API or personal data.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),[outputArg,databaseArg]=process.argv.slice(2);
if(!outputArg||!databaseArg||!/^verification-.*\.db$/.test(path.basename(databaseArg)))throw Error('Use private output.json and a disposable verification-*.db');
const output=path.resolve(outputArg),database=path.resolve(databaseArg);
const {server,prisma}=require(path.join(repo,'scripts/local-server.cjs')).startLocal({port:0,database,mode:'mock'});
const get=n=>require(path.join(repo,'backend/dist/src/assessment',n+'.js'));
const {definitions}=get('definitions'),{sealSnapshot,readSnapshot}=get('runtime'),{answeredOpportunities}=get('responseQuality'),{validateSample,aggregateSamples}=get('judge'),{candidateCatalog,decodeJudgeRanges}=get('evidenceProtocol'),{strictJson}=get('strictJson');
const checks=[];let provider,requests=0,base;
const kinds={director:0,npc:0,guard:0,judge:0};
async function api(route,data,stream=false){
 const r=await fetch(base+'/api/'+route,data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}),text=await r.text();
 assert(r.ok,text);assert(!text.includes('assessmentSnapshotJson'));assert(!text.includes('anchors'));
 if(!stream)return JSON.parse(text);
 assert(text.includes('event: done\ndata: '),'SSE must reach its final event');
 return JSON.parse(text.split('event: done\ndata: ')[1].split('\n\n')[0]);
}
async function main(){
 await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
 assert.equal(await prisma.assessmentSession.count(),0,'Use an empty isolated test database');
 provider=http.createServer(async(req,res)=>{try{
  let body='';for await(const c of req)body+=c;const request=JSON.parse(body),input=JSON.parse(request.messages[1].content);requests++;
  let answer;
  if(input.evidence_protocol){
   kinds.judge++;assert.equal(input.evidence_protocol,'ge8-evidence-ranges/2');
   answer={scores:input.definition.dimensions.map(d=>[d.id,8,'合成本机响应：两个明确问题后只给相关态度，具体依据或行动未展开。']),evidence:input.definition.slots.map(slot=>{
    const link=input.answered_opportunities[slot.slot_id]?.at(-1);assert(link,'Every point must have an answered question');
    const m=input.messages.find(m=>m.id===link.response_message_id);assert(m?.senderType==='user');
    const segments=m.candidate_segments;return [slot.display_code,segments[0][0],segments.at(-1)[0],'partial','mixed',`合成校验：针对“${slot.probe_intent}”的回应仍只给笼统态度，没有具体展开。`];
   })};
  }else if(input.draft){kinds.guard++;answer={no_change:true,issues:[]};
  }else if(input.role_profile){kinds.npc++;answer={visible_reply:{speaker:input.role_profile.name,role:input.role_profile.role,content:'请具体说明你的判断和接下来的安排。'}};
  }else{
   kinds.director++;assert(input.latest_candidate_message_id);
   // Repeated suggestions deliberately try to starve other points; the scheduler must resist.
   answer={slot_evidence:[],should_finish:true,next_probe:{agent:'leader',slot_ids:input.slots.filter(s=>s.target_agent==='leader').slice(0,2).map(s=>s.slot_id)}};
  }
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(answer)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));
 }catch(e){res.statusCode=500;res.end(e.message);}});
 await new Promise(r=>provider.listen(0,'127.0.0.1',r));process.env.DEEPSEEK_API_KEY='synthetic-loopback-only';
 const localUrl='http://127.0.0.1:'+provider.address().port;
 for(const d of definitions){
  assert.equal(d.scoring_policy.evidence_policy,'response-quality/1');
  const start=await api('assessment/start',{scenario_id:d.scenario_id}),id=start.session_id;
  const first=await prisma.assessmentSession.findUniqueOrThrow({where:{id}}),snapshot=JSON.parse(first.assessmentSnapshotJson);
  snapshot.model.mock=false;snapshot.model.base_url=localUrl;const rawSnapshot=JSON.stringify(sealSnapshot(snapshot));
  await prisma.assessmentSession.update({where:{id},data:{assessmentSnapshotJson:rawSnapshot}});
  let result;
  for(let round=1;round<=15;round++){
   result=await api('assessment/message/stream',{session_id:id,content:'我知道了。我会重视这些事情，认真努力，做好各方面的工作。'},true);
   assert.equal(result.round,round);assert.equal(result.finished,round===15);
  }
  const s=await prisma.assessmentSession.findUniqueOrThrow({where:{id}}),state=JSON.parse(s.blackboardState),report=JSON.parse(s.reportJson),messages=await prisma.message.findMany({where:{sessionId:id},orderBy:[{roundIndex:'asc'},{createdAt:'asc'}]});
  assert.equal(s.status,'finished');assert.equal(s.round,15);assert.equal(s.scoringAttempts,1);assert.equal(s.assessmentSnapshotJson,rawSnapshot);
  assert.equal(messages.filter(m=>m.senderType==='user').length,15);
  for(const slot of d.slots)assert(answeredOpportunities(slot.slot_id,d,state,messages).length>0,slot.display_code+' was never answered');
  for(const event of d.events){const m=messages.find(m=>m.id===state.released_events[event.id]);assert(m&&m.roundIndex===event.round&&m.senderName===d.roles[event.agent].name&&m.content.includes(event.facts[0].text));}
  let last,consecutive=0;for(const m of messages.filter(m=>m.senderType==='agent')){consecutive=last===m.senderName?consecutive+1:1;last=m.senderName;assert(consecutive<=2);}
  assert.equal(report.report_status,'confident');assert.equal(report.total_score,64);assert(report.dimension_results.every(d=>d.status==='rated'&&d.score===8));
  assert(report.dimension_results.flatMap(d=>d.slot_results).every(s=>s.sufficiency==='partial'&&s.evidence.every(e=>e.response_context)));
  validateSample({dimension_results:report.dimension_results},d,state,messages);
  const calls=await prisma.assessmentCallAudit.findMany({where:{sessionId:id},orderBy:{kind:'asc'}});assert(calls.every(a=>!a.error));
  const scoring=calls.filter(a=>a.kind.startsWith('judge/'));assert.equal(scoring.length,5);assert(scoring.every(a=>a.runId===s.scoringRunId));
  const catalog=candidateCatalog(messages),samples=scoring.map(a=>validateSample(decodeJudgeRanges(strictJson(a.responseJson),d,state,catalog),d,state,messages));
  const repeated=aggregateSamples(samples,readSnapshot(rawSnapshot),state,report.sampling_stats.attempts);assert.deepEqual(repeated.dimension_results,report.dimension_results);
  const before=requests;assert.deepEqual((await api('assessment/session/'+id)).report,report);
  const again=await api('assessment/message',{session_id:id,content:'测评已经完成。'});assert(again.finished);assert.equal(requests,before);
  checks.push({scene:d.scenario_code,rounds:15,answered_points:16,judges:5,sse_complete:true,fixed_events_correct:true,repeated_director_suggestion_cannot_skip_points:true,question_response_links_verified:true,original_snapshot_unchanged:true,repeated_finish_and_get_free:true});
 }
 const result={passed:true,external_requests:0,loopback_requests:requests,kinds,checks,interpretation:'Deterministic local workflow verification only; these synthetic scores do not establish real model quality or measurement validity.'};
 fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{provider?.closeAllConnections();provider?.close();server.closeAllConnections();server.close(()=>prisma.$disconnect());});
