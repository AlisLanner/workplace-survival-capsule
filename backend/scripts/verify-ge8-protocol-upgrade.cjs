// Run only on a consistent disposable COPY of an installed v9 database.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),[output,database]=process.argv.slice(2);
if(!output||!database||!/^verification-.*\.db$/.test(path.basename(database)))throw Error('Use private output.json and a disposable verification-*.db COPY of v9');
const {server,prisma}=require(path.join(repo,'scripts/local-server.cjs')).startLocal({port:0,database,mode:'mock'});
const get=n=>require(path.join(repo,'backend/dist/src/assessment',n+'.js'));
const {definitions,getDefinition}=get('definitions'),{startGe8,runGe8,retryScoring}=get('session'),{installGe8}=get('install');
const {getAssessmentSession}=require(path.join(repo,'backend/dist/src/services/assessment.service.js'));
async function main(){
 await new Promise(r=>server.once('listening',r));
 const original=await prisma.assessmentSession.findMany(),oldPrompts=await prisma.promptTemplate.findMany({orderBy:{key:'asc'}}),beforeD=await prisma.scenario.findUniqueOrThrow({where:{id:'handover_review_crisis'}});
 const scenes=await prisma.scenario.findMany();assert.equal(scenes.filter(s=>s.assessmentVersion==='ge8-20261016.9').length,4);const calls=await prisma.assessmentCallAudit.count();
 for(const s of scenes.filter(s=>s.assessmentVersion))assert.deepEqual(JSON.parse(s.assessmentDefinitionJson),getDefinition(s.id,s.assessmentVersion));
 const underway=[];for(const d of definitions){const start=await startGe8(d.scenario_id,{}),s=await prisma.assessmentSession.findUniqueOrThrow({where:{id:start.session_id}});assert.equal(s.assessmentVersion,'ge8-20261016.9');assert(!JSON.parse(s.assessmentSnapshotJson).model.judge.output_protocol);underway.push(s);}
 const preview=await installGe8(false);assert.equal(preview.changes.length,4);assert(preview.changes.every(c=>c.from_version==='ge8-20261016.9'));
 await installGe8(true);assert.equal((await installGe8(true)).already_installed,true);
 for(const s of original){const after=await prisma.assessmentSession.findUniqueOrThrow({where:{id:s.id}});assert.deepEqual(after,s);if(s.reportJson){const view=await getAssessmentSession(s.id);assert.deepEqual(view.report,JSON.parse(s.reportJson));assert.equal(view.scenario.assessmentVersion,s.assessmentVersion);if(s.scoringAttempts>=2)await assert.rejects(retryScoring(s.id),/上限/);}}
 for(const p of oldPrompts)assert.deepEqual(await prisma.promptTemplate.findUniqueOrThrow({where:{id:p.id}}),p);
 assert.deepEqual(await prisma.scenario.findUniqueOrThrow({where:{id:beforeD.id}}),beforeD);
 for(const s of underway){await runGe8(s.id,'我先核对已经提供的任务事实，区分尚需确认的事项，再明确自己承担的下一步。');const after=await prisma.assessmentSession.findUniqueOrThrow({where:{id:s.id}});assert.equal(after.assessmentSnapshotJson,s.assessmentSnapshotJson);assert.equal(after.round,1);assert.equal((await getAssessmentSession(s.id)).scenario.assessmentVersion,'ge8-20261016.9');}
 for(const d of definitions){const start=await startGe8(d.scenario_id,{}),s=await prisma.assessmentSession.findUniqueOrThrow({where:{id:start.session_id}}),snapshot=JSON.parse(s.assessmentSnapshotJson);assert.equal(s.assessmentVersion,'ge8-20261016.10');assert.equal(snapshot.model.judge.output_protocol,'ge8-evidence-ranges/1');assert(snapshot.model.judge.protocol_hash);}
 assert.equal(await prisma.assessmentCallAudit.count(),calls);
 const result={passed:true,external_requests:0,preserved_original_sessions:original.length,checks:['v9 definitions and templates preserved','four installed scenarios upgrade atomically and idempotently','all original reports/snapshots/statuses unchanged','four in-flight v9 sessions still use original protocol','new starts use sealed v10 range protocol','finished exhausted source sessions cannot score a third batch','GET and migration make no model calls']};fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.closeAllConnections();server.close(()=>prisma.$disconnect());});
