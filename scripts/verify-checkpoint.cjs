const fs=require('node:fs');const path=require('node:path');const {DatabaseSync}=require('node:sqlite');
const {inside,sha,git}=require('./checkpoint.cjs');
function verifyCheckpoint(directory){
  const m=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  if(m.format!=='maat-checkpoint/1')throw Error('Unsupported checkpoint format');
  for(const [rel,hash]of Object.entries(m.files)){const file=inside(directory,path.join(directory,rel));if(sha(file)!==hash)throw Error('Checkpoint hash mismatch: '+rel);}
  git(m.source_repo,['bundle','verify',path.join(directory,'code.bundle')]);
  const db=new DatabaseSync(path.join(directory,'database.db'),{readOnly:true});
  try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('SQLite integrity failed');for(const[t,n]of Object.entries(m.table_counts))if(Number(db.prepare('SELECT COUNT(*) AS n FROM "'+t.replaceAll('"','""')+'"').get().n)!==n)throw Error('Table count mismatch: '+t);}finally{db.close();}
  return m;
}
module.exports={verifyCheckpoint};
if(require.main===module){try{const m=verifyCheckpoint(path.resolve(process.argv[2]));console.log(JSON.stringify({verified:true,checkpoint_id:m.checkpoint_id,code_sha:m.code_sha},null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
