const path=require('node:path');const fs=require('node:fs');
async function probe(repo,database){
  process.chdir(path.join(repo,'backend'));process.env.DATABASE_URL='file:'+database.replaceAll('\\','/');process.env.USE_MOCK_LLM='true';process.env.DEEPSEEK_API_KEY='';
  const express=require(path.join(repo,'node_modules/express'));const {app}=require(path.join(repo,'backend/dist/src/app.js'));const {prisma}=require(path.join(repo,'backend/dist/src/db/prisma.js'));
  const front=path.join(repo,'frontend/dist');if(!fs.existsSync(path.join(front,'index.html')))throw Error('Restored frontend missing');
  const server=app.listen(0,'127.0.0.1');
  try{await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});const base='http://127.0.0.1:'+server.address().port;const health=await fetch(base+'/health');if(!health.ok)throw Error('Restored health failed');const scenarios=await(await fetch(base+'/api/assessment/scenarios')).json();if(!Array.isArray(scenarios)||!scenarios.length)throw Error('Restored scenarios unavailable');return {health:true,frontend:true,scenarios:scenarios.length};}
  finally{await new Promise(r=>server.close(r));await prisma.$disconnect();}
}
module.exports={probe};
if(require.main===module)probe(path.resolve(process.argv[2]),path.resolve(process.argv[3])).then(r=>console.log('RESTORE_PROBE='+JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
