const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const cp=require('node:child_process');
const {DatabaseSync,backup}=require('node:sqlite');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function inside(root,target){const r=path.resolve(root),t=path.resolve(target),rel=path.relative(r,t);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('Unsafe target path: '+t);return t;}
function git(repo,args,options={}){return cp.execFileSync('git',['-C',repo,...args],{encoding:'utf8',windowsHide:true,...options});}
function files(dir,base=dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Checkpoint symlinks are not supported: '+p);return e.isDirectory()?files(p,base):[path.relative(base,p)];});}
async function createCheckpoint({repo,database,storage,id}) {
  repo=fs.realpathSync(repo);database=fs.realpathSync(database);storage=path.resolve(storage);
  const destination=inside(storage,path.join(storage,id||new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex')));
  fs.mkdirSync(destination,{recursive:false});
  const code=git(repo,['rev-parse','HEAD']).trim();
  git(repo,['bundle','create',path.join(destination,'code.bundle'),'--all']);git(repo,['bundle','verify',path.join(destination,'code.bundle')]);
  const patch=git(repo,['diff','HEAD','--binary'],{encoding:'buffer'});fs.writeFileSync(path.join(destination,'working.patch'),patch);
  const untracked=git(repo,['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
  for(const rel of untracked){const source=inside(repo,path.join(repo,rel));const target=inside(destination,path.join(destination,'untracked',rel));fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);}
  const db=new DatabaseSync(database,{readOnly:true});
  await backup(db,path.join(destination,'database.db'));
  const snap=new DatabaseSync(path.join(destination,'database.db'),{readOnly:true});
  if(snap.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('SQLite integrity check failed');
  const tables=snap.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
  const counts=Object.fromEntries(tables.map(t=>[t,Number(snap.prepare('SELECT COUNT(*) AS n FROM "'+t.replaceAll('"','""')+'"').get().n)]));
  const exports={};for(const t of ['Scenario','PromptTemplate'])if(tables.includes(t))exports[t]=snap.prepare('SELECT * FROM '+t).all();
  fs.writeFileSync(path.join(destination,'templates-scenarios.json'),JSON.stringify(exports,null,2));
  snap.close();db.close();
  const config=path.join(repo,'backend/.env');if(fs.existsSync(config))fs.copyFileSync(config,path.join(destination,'backend.env'));
  for(const rel of ['backend/dist','frontend/dist'])if(fs.existsSync(path.join(repo,rel)))fs.cpSync(path.join(repo,rel),path.join(destination,rel),{recursive:true});
  fs.mkdirSync(path.join(destination,'tools'));for(const name of ['checkpoint.cjs','verify-checkpoint.cjs','restore-local.cjs','probe-restored.cjs'])fs.copyFileSync(path.join(__dirname,name),path.join(destination,'tools',name));
  const manifest={format:'maat-checkpoint/1',checkpoint_id:path.basename(destination),created_at:new Date().toISOString(),code_sha:code,source_repo:repo,source_database:database,table_counts:counts,status:git(repo,['status','--porcelain']),untracked,files:Object.fromEntries(files(destination).map(rel=>[rel,sha(path.join(destination,rel))])),user_accepted:false};
  fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2));return {directory:destination,manifest};
}
module.exports={createCheckpoint,inside,sha,git,files};
if(require.main===module){const [repo,database,storage,id]=process.argv.slice(2);if(!repo||!database||!storage)throw Error('Usage: checkpoint.cjs repo database existing-storage [id]');createCheckpoint({repo,database,storage,id}).then(r=>console.log(JSON.stringify({checkpoint:r.directory,code_sha:r.manifest.code_sha,counts:r.manifest.table_counts},null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});}
