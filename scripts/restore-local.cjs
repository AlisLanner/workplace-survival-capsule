const fs=require('node:fs');const path=require('node:path');const cp=require('node:child_process');const crypto=require('node:crypto');
const {verifyCheckpoint}=require('./verify-checkpoint.cjs');const {createCheckpoint,inside,git,sha}=require('./checkpoint.cjs');
function assertNoActiveWriter(database) {
  const {DatabaseSync}=require('node:sqlite');let db;
  try{db=new DatabaseSync(database);db.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE; ROLLBACK;');}
  catch{throw Error('Current database is locked or unavailable; unknown active writer may exist. Stop that writer before switching; entry unchanged.');}
  finally{db?.close();}
}
async function restore({checkpoint,project,currentRepo,currentDatabase,npmCli,switchEntry=false,dryRun=false}) {
  project=fs.realpathSync(project);checkpoint=fs.realpathSync(checkpoint);
  for(const name of ['版本备份','版本恢复']){const dir=path.join(project,name);if(fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw Error('Restore directories must not be symlinks or junctions');}
  // Every generated destination stays under explicitly chosen project directories; no recursive delete/move is used.
  const m=verifyCheckpoint(checkpoint);
  const target=inside(path.join(project,'版本恢复'),path.join(project,'版本恢复',m.checkpoint_id+'-'+crypto.randomBytes(3).toString('hex')));
  if(dryRun)return {dry_run:true,code_sha:m.code_sha,database_time:m.created_at,target};
  if(!currentRepo||!currentDatabase)throw Error('Current repo/database required to preserve the pre-restore scene');
  assertNoActiveWriter(currentDatabase);
  fs.mkdirSync(path.join(project,'版本备份'),{recursive:true});fs.mkdirSync(path.join(project,'版本恢复'),{recursive:true});
  const before=await createCheckpoint({repo:currentRepo,database:currentDatabase,storage:path.join(project,'版本备份'),id:'before-restore-'+Date.now()});
  cp.execFileSync('git',['clone','--no-checkout',path.join(checkpoint,'code.bundle'),target],{windowsHide:true,stdio:'pipe'});
  git(target,['checkout','--detach',m.code_sha]);
  const patch=path.join(checkpoint,'working.patch');if(fs.statSync(patch).size)git(target,['apply','--binary',patch]);
  if(fs.existsSync(path.join(checkpoint,'untracked')))fs.cpSync(path.join(checkpoint,'untracked'),target,{recursive:true});
  const database=path.join(target,'backend/prisma/restored.db');fs.copyFileSync(path.join(checkpoint,'database.db'),database);
  const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(database,{readOnly:true});
  const applied=db.prepare('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL').all().map(r=>r.migration_name).sort();db.close();
  const migrations=fs.readdirSync(path.join(target,'backend/prisma/migrations'),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
  if(JSON.stringify(applied)!==JSON.stringify(migrations))throw Error('Restored code and database migrations do not match; entry unchanged');
  if(fs.existsSync(path.join(checkpoint,'backend.env')))fs.copyFileSync(path.join(checkpoint,'backend.env'),path.join(target,'backend/.env'));
  for(const rel of ['backend/dist','frontend/dist'])if(fs.existsSync(path.join(checkpoint,rel)))fs.cpSync(path.join(checkpoint,rel),path.join(target,rel),{recursive:true});
  npmCli=npmCli||path.join(project,'开发工具/npm/package/bin/npm-cli.js');if(!fs.existsSync(npmCli))throw Error('npm CLI unavailable: provide --npm-cli');
  const env={...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH,DATABASE_URL:'file:'+database.replaceAll('\\','/')};
  cp.execFileSync(process.execPath,[npmCli,'ci','--no-audit','--no-fund'],{cwd:target,env,windowsHide:true,stdio:'pipe',timeout:300000});
  cp.execFileSync(process.execPath,[path.join(target,'node_modules/prisma/build/index.js'),'generate','--schema',path.join(target,'backend/prisma/schema.prisma')],{cwd:path.join(target,'backend'),env,windowsHide:true,stdio:'pipe',timeout:120000});
  const probe=cp.execFileSync(process.execPath,[path.join(checkpoint,'tools/probe-restored.cjs'),target,database],{env,windowsHide:true,encoding:'utf8',timeout:45000});
  if(!probe.includes('RESTORE_PROBE='))throw Error('Restore startup probe did not confirm success');
  if(sha(database)!==m.files['database.db'])throw Error('Startup probe changed restored database unexpectedly');
  const record={restored_at:new Date().toISOString(),checkpoint_id:m.checkpoint_id,code_sha:m.code_sha,repo:target,database,snapshot_time:m.created_at,preserved_before_restore:before.directory,scope:'Target snapshot only. New sessions remain preserved in pre-restore checkpoint.',probe:probe.slice(probe.indexOf('RESTORE_PROBE='))};
  fs.writeFileSync(path.join(target,'restoration.json'),JSON.stringify(record,null,2));
  if(switchEntry){assertNoActiveWriter(currentDatabase);const pointer=path.join(project,'stable-launch.json');const tmp=pointer+'.'+crypto.randomBytes(3).toString('hex')+'.tmp';fs.writeFileSync(tmp,JSON.stringify(record,null,2));fs.renameSync(tmp,pointer);}
  return {...record,entry_switched:switchEntry};
}
module.exports={restore,assertNoActiveWriter};
if(require.main===module){const arg=k=>{const i=process.argv.indexOf(k);return i<0?undefined:process.argv[i+1];};restore({checkpoint:arg('--checkpoint'),project:arg('--project'),currentRepo:arg('--current-repo'),currentDatabase:arg('--current-database'),npmCli:arg('--npm-cli'),dryRun:process.argv.includes('--dry-run'),switchEntry:process.argv.includes('--switch')}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});}
