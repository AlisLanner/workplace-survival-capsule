const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const repo=path.resolve(__dirname,'..');
function startLocal({port=17861,database,mode='mock'}={}) {
  process.chdir(path.join(repo,'backend'));
  require(path.join(repo,'node_modules/dotenv')).config({path:path.join(repo,'backend/.env')});
  const db=database||path.join(repo,'backend/prisma/ge8.db');
  if(!fs.existsSync(db))throw Error('Database not initialized: use a migrated copy and assessment:install first.');
  process.env.DATABASE_URL='file:'+db.replaceAll('\\','/');
  process.env.USE_MOCK_LLM=mode==='mock'?'true':'false';
  if(mode==='mock')process.env.DEEPSEEK_API_KEY='';
  if(mode!=='mock'&&!process.env.DEEPSEEK_API_KEY)throw Error('Real mode requires a locally configured API key.');
  const express=require(path.join(repo,'node_modules/express'));
  const {app}=require(path.join(repo,'backend/dist/src/app.js'));
  const {prisma}=require(path.join(repo,'backend/dist/src/db/prisma.js'));
  const {VERSION}=require(path.join(repo,'backend/dist/src/assessment/definitions.js'));
  const frontend=path.join(repo,'frontend/dist');
  if(!fs.existsSync(path.join(frontend,'index.html')))throw Error('Frontend build is missing.');
  const site=express();
  let sha='unknown';try{sha=require('node:child_process').execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();}catch{}
  site.get('/version',(_req,res)=>res.json({code_sha:sha,assessment_version:VERSION,mode}));
  site.use(express.static(frontend));site.get('*',(_req,res)=>res.sendFile(path.join(frontend,'index.html')));
  const server=http.createServer((req,res)=>/^\/(api(?:\/|$)|health(?:\?|$))/.test(req.url)?app(req,res):site(req,res));
  server.listen(port,'127.0.0.1');
  return {server,prisma};
}
module.exports={startLocal};
if(require.main===module) {
  const option=(key,fallback)=>{const i=process.argv.indexOf(key);return i>=0?process.argv[i+1]:fallback;};
  try {
    const mode=option('--mode','mock');const port=Number(option('--port','17861'));
    const {server,prisma}=startLocal({port,database:option('--database'),mode});
    server.once('listening',()=>console.log(`GE8 candidate | ${mode} | http://127.0.0.1:${port} | version: /version`));
    server.on('error',e=>{console.error(e.message);prisma.$disconnect().finally(()=>process.exit(1));});
    const stop=()=>{server.close(()=>prisma.$disconnect().finally(()=>process.exit(0)));server.closeAllConnections();};
    process.on('SIGINT',stop);process.on('SIGTERM',stop);
  }catch(e){console.error(e.message);process.exitCode=1;}
}
