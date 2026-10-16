// Runs only against an explicitly named disposable verification database.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..');
const output=process.argv[2];const database=process.argv[3];
if(!output||!database||!/^verification-.*\.db$/.test(path.basename(database)))throw Error('Usage: verify-ge8.cjs output.json /absolute/path/verification-*.db');
const {startLocal}=require(path.join(repo,'scripts/local-server.cjs'));
process.env.ADMIN_SECRET='synthetic-verification-only';
const {server,prisma}=startLocal({port:0,database,mode:'mock'});
const checks=[];const reports=[];
async function main(){
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base='http://127.0.0.1:'+server.address().port;
  const api=async(route,data)=>{const headers={'Content-Type':'application/json','x-admin-secret':process.env.ADMIN_SECRET};const r=await fetch(base+'/api/'+route,data===undefined?{headers}:{method:'POST',headers,body:JSON.stringify(data)});const t=await r.json();if(!r.ok)throw Error(JSON.stringify(t));return t;};
  assert.equal((await fetch(base+'/api/admin/sessions')).status,401);checks.push('private admin routes require a local secret');
  const {definitions,hash}=require(path.join(repo,'backend/dist/src/assessment/definitions.js'));
  const {installGe8}=require(path.join(repo,'backend/dist/src/assessment/install.js'));
  const {updatePrompt}=require(path.join(repo,'backend/dist/src/services/admin.service.js'));
  assert.equal((await installGe8(true)).already_installed,true);checks.push('installation idempotent');
  const scenarios=await api('assessment/scenarios');assert.equal(scenarios.length,5);assert.equal(scenarios.filter(s=>s.assessmentVersion).length,4);assert.equal(scenarios.find(s=>s.id==='handover_review_crisis').assessmentVersion,null);
  assert(!JSON.stringify(scenarios).includes('anchors'));checks.push('4 new scenes, legacy D and no scenario definition leakage');
  for(const d of definitions){
    const start=await api('assessment/start',{scenario_id:d.scenario_id,nickname:'合成验证'});const id=start.session_id;
    assert.equal(start.blackboard.assessment_version,d.assessment_version);assert(!JSON.stringify(start).includes('assessmentSnapshotJson'));
    const before=await prisma.assessmentSession.findUnique({where:{id}});const frozen=JSON.parse(before.assessmentSnapshotJson);
    let result;
    for(let round=1;round<=15;round++){
      const row=await prisma.assessmentSession.findUnique({where:{id}});const state=JSON.parse(row.blackboardState);
      const ready=d.slots.filter(s=>s.required_fact_ids.every(f=>state.released_facts[f]) && !state.slots[s.slot_id].evidence.some(e=>e.sufficiency==='sufficient'));
      const content=ready.map((s,i)=>`【${s.display_code}】这是${s.display_code}的独立合成行为片段，具体判断和行动在该点单独表达。`).join('\n')||'请继续。';
      if(round===2){
        const r=await fetch(base+'/api/assessment/message/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:id,content})});
        const text=await r.text();assert(text.includes('event: done'));assert(!text.includes('assessmentSnapshotJson'));assert(!text.includes('anchors'));const done=text.split('event: done\ndata: ')[1];result=JSON.parse(done.split('\n\n')[0]);
      }else result=await api('assessment/message',{session_id:id,content});
      assert(!JSON.stringify(result.blackboard).includes('slots'));
      if(result.finished)break;
    }
    assert.equal(result.finished,true);assert.equal(result.report.report_status,'debug');assert.equal(result.report.total_score,null);assert.equal(result.report.dimension_results.length,8);
    assert(result.report.dimension_results.every(r=>r.status==='rated'));assert.equal(result.report.radar_chart_data.length,8);
    const row=await prisma.assessmentSession.findUnique({where:{id}});assert.equal(row.totalScore,null);assert.equal(row.scoringAttempts,1);assert.equal(row.assessmentSnapshotJson,before.assessmentSnapshotJson);
    const state=JSON.parse(row.blackboardState);for(const e of d.events){assert(state.released_events[e.id]);const m=await prisma.message.findUnique({where:{id:state.released_events[e.id]}});assert(m.content.includes(e.facts[0].text));assert(m.roundIndex<=5);}
    const repeat=await api('assessment/message',{session_id:id,content:'重复结束'});assert.equal(repeat.finished,true);assert.equal((await prisma.assessmentSession.findUnique({where:{id}})).scoringAttempts,1);
    const sessionView=await api('assessment/session/'+id);assert(!JSON.stringify(sessionView).includes('assessmentSnapshotJson'));assert(!JSON.stringify(sessionView).includes('anchors'));
    reports.push({scenario:d.scenario_id,session_id:id,report:result.report});checks.push(d.scenario_code+': full mock dialogue, SSE, actual events, 8 dimensions, no formal total, idempotent finish');
    // Empty/timeout case must retain missing status and no zero-filled radar.
    const missing=await api('assessment/start',{scenario_id:d.scenario_id});const end=await api('assessment/message',{session_id:missing.session_id,content:'__ASSESSMENT_TIME_EXPIRED__'});
    assert.equal(end.report.total_score,null);assert(end.report.dimension_results.every(r=>r.score===null));assert.equal(end.report.radar_chart_data.length,0);assert.deepEqual(end.report.dimension_scores,{});
    checks.push(d.scenario_code+': timeout preserves nulls and omits complete radar');
  }
  const snapStart=await api('assessment/start',{scenario_id:definitions[0].scenario_id});
  const old=await prisma.assessmentSession.findUnique({where:{id:snapStart.session_id}});const oldSnapshot=JSON.parse(old.assessmentSnapshotJson);
  const originalKey=oldSnapshot.prompts.director.key;const newPrompt=await updatePrompt(originalKey,{content:oldSnapshot.prompts.director.content+'\n修订验证：不修改会话事实。'});
  assert.notEqual(newPrompt.key,originalKey);assert.equal((await prisma.promptTemplate.findUnique({where:{key:originalKey}})).content,oldSnapshot.prompts.director.content);
  const next=await api('assessment/start',{scenario_id:definitions[0].scenario_id});const newer=await prisma.assessmentSession.findUnique({where:{id:next.session_id}});
  assert.notEqual(JSON.parse(newer.assessmentSnapshotJson).prompts.director.hash,oldSnapshot.prompts.director.hash);
  assert.equal((await prisma.assessmentSession.findUnique({where:{id:snapStart.session_id}})).assessmentSnapshotJson,old.assessmentSnapshotJson);
  checks.push('immutable prompt revision and existing session snapshot preserved');
  const legacy=await api('assessment/start',{scenario_id:'handover_review_crisis'});assert(!legacy.blackboard.assessment_version);await api('assessment/message',{session_id:legacy.session_id,content:'先核对现有承诺和来源，再安排评审材料。'});checks.push('legacy D starts and continues');
  const dashboard=await api('admin/dashboard');assert.equal(dashboard.average_score,null);assert.equal(dashboard.groups.length,0);checks.push('debug and incomplete reports excluded from statistics');
  fs.writeFileSync(output,JSON.stringify({passed:true,checks,reports},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close(()=>prisma.$disconnect()));
