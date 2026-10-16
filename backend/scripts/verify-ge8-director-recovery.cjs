// Synthetic loopback provider only. Never sends user answers to an external model.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),[output,database]=process.argv.slice(2);
if(!output||!database||!/^verification-.*\.db$/.test(path.basename(database)))throw Error('Use output.json and a disposable verification-*.db');
const {server,prisma}=require(path.join(repo,'scripts/local-server.cjs')).startLocal({port:0,database,mode:'mock'});
const {definitions}=require(path.join(repo,'backend/dist/src/assessment/definitions.js'));
const {startGe8,runGe8}=require(path.join(repo,'backend/dist/src/assessment/session.js'));
const {sealSnapshot}=require(path.join(repo,'backend/dist/src/assessment/runtime.js'));let provider;const requests=[];
async function main(){await new Promise(r=>server.once('listening',r));
 provider=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;const request=JSON.parse(body),input=JSON.parse(request.messages[1].content);requests.push(input);let result;
  if(input.role_profile)result={visible_reply:{speaker:input.role_profile.name,role:input.role_profile.role,content:'请说明你现在的判断与下一步。'}};
  else result={should_finish:false,slot_evidence:[{slot_id:input.slots[0].slot_id,message_id:input.latest_candidate_message_id,quote:'不存在于候选人消息的改写文本',sufficiency:'sufficient',valence:'support',reason:'synthetic invalid quote'}]};
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));
 });await new Promise(r=>provider.listen(0,'127.0.0.1',r));process.env.DEEPSEEK_API_KEY='synthetic-loopback-only';const checks=[];
 for(const d of definitions){const s=await startGe8(d.scenario_id,{});const row=await prisma.assessmentSession.findUniqueOrThrow({where:{id:s.session_id}});const snapshot=JSON.parse(row.assessmentSnapshotJson);snapshot.model.mock=false;snapshot.model.base_url='http://127.0.0.1:'+provider.address().port;snapshot.runtime.group_chat_enabled=false;const raw=JSON.stringify(sealSnapshot(snapshot));await prisma.assessmentSession.update({where:{id:row.id},data:{assessmentSnapshotJson:raw}});
  const content='我先核对已知条件和仍需确认的事项，再明确本人能承担的工作及下一步安排。';
  if(d.scenario_code==='A'){const state=JSON.parse(row.blackboardState);state.round=1;await prisma.message.create({data:{sessionId:row.id,senderType:'user',senderName:'候选人',content,roundIndex:1}});await prisma.assessmentSession.update({where:{id:row.id},data:{round:1,blackboardState:JSON.stringify(state)}});await assert.rejects(runGe8(row.id,'另一个回答'),/上一条回答已保存/);assert.equal(requests.length,0);}
  const base='http://127.0.0.1:'+server.address().port;const response=await fetch(base+'/api/assessment/message/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:row.id,content})});const stream=await response.text();assert(stream.includes('event: done'));assert(!stream.includes('event: error'));assert(!stream.includes('不存在于候选人消息的改写文本'));
  const after=await prisma.assessmentSession.findUniqueOrThrow({where:{id:row.id}}),state=JSON.parse(after.blackboardState);assert.equal(after.round,1);assert.equal(after.assessmentSnapshotJson,raw);assert.equal(after.turnLockId,null);assert.equal(await prisma.message.count({where:{sessionId:row.id,senderType:'user'}}),1);assert(Object.values(state.slots).every(s=>s.evidence.length===0));assert.equal(await prisma.agentTraceEvent.count({where:{sessionId:row.id,nodeId:'directorRecovery'}}),1);
  const calls=await prisma.assessmentCallAudit.findMany({where:{sessionId:row.id}});assert.equal(calls.filter(c=>c.kind==='director').length,2);assert(calls.filter(c=>c.kind==='director').every(c=>c.error));assert.equal(calls.length,3);assert(calls.every(c=>JSON.parse(c.requestJson).baseUrl.startsWith('http://127.0.0.1:')));checks.push(d.scenario_code+': invalid extraction rejected, SSE continues, missing not zero, one saved answer/round; '+(d.scenario_code==='A'?'saved failed turn resumed':'new turn'));
 }
 fs.writeFileSync(output,JSON.stringify({passed:true,external_requests:0,loopback_requests:requests.length,checks},null,2));console.log('DIRECTOR_RECOVERY_VERIFIED='+JSON.stringify({checks:checks.length,external_requests:0}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{provider?.closeAllConnections();provider?.close();server.closeAllConnections();server.close(()=>prisma.$disconnect());});
