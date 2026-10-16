// Read-only, file-backed reports. This module never loads a database, credentials or an LLM client.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function createSavedReportViewer({frontend,records}){
 frontend=fs.realpathSync(frontend);
 if(!Array.isArray(records)||!records.length)throw Error('Saved report catalog is empty');
 const byId=new Map();for(const r of records){if(!/^[a-zA-Z0-9_-]+$/.test(r.session_id)||byId.has(r.session_id)||!r.report||!Array.isArray(r.detail?.messages))throw Error('Invalid saved report catalog');byId.set(r.session_id,r);}
 const catalog=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>新评分规则 · 只读样例</title><style>body{font:18px/1.8 system-ui;max-width:860px;margin:36px auto;padding:0 22px;color:#263734;background:#f4f6f3}h1{font-size:28px}li{margin:18px 0}a{color:#205f58}.note{padding:20px;background:white;border-radius:12px}</style><h1>新评分规则 · 只读样例</h1><p class="note">以下是已保存的合成作答及真实模型评分。查看不调用模型，不产生API费用；本入口只允许查看。它们展示“表达空泛”及“已有行动但细节不足”的结果，供检查新版报告使用。新版仍待完成剩余真实验收，尚未安装到真实测评入口。</p><ul>${records.map(r=>`<li><a href="/report/${r.session_id}">${escape(r.label)}</a><br><small>测量版本 ${escape(r.report.assessment_version)} · 八维均分 ${escape(r.mean)} / 20</small></li>`).join('')}</ul><p>这些是合成工程样例，不是真实应聘者成绩，也不代表新版测量效度。每份报告保留当时的版本、原文与实际评分。</p></html>`;
 const notice='<div style="padding:14px 22px;background:#203e38;color:#fff;font:16px/1.6 system-ui">只读样例 · 查看不会调用模型或产生API费用 · <a href="/" style="color:#fff;text-decoration:underline">返回样例目录</a></div>';
 const app=fs.readFileSync(path.join(frontend,'index.html'),'utf8').replace(/<body[^>]*>/,m=>m+notice);
 return http.createServer((req,res)=>{
  const send=(status,type,body)=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);};
  const json=(status,x)=>send(status,'application/json; charset=utf-8',JSON.stringify(x));
  if(!['GET','HEAD'].includes(req.method))return json(403,{error:'此入口只读；仅展示已保存的样例，不启动测评或评分。'});
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{return json(400,{error:'Invalid path'});}
  if(pathname==='/')return send(200,'text/html; charset=utf-8',catalog);
  if(pathname==='/health')return json(200,{status:'ok',read_only:true,external_model_calls:0});
  const api=pathname.match(/^\/api\/assessment\/(report|session)\/([a-zA-Z0-9_-]+)$/);
  if(api){const r=byId.get(api[2]);return r?json(200,api[1]==='report'?r.report:r.detail):json(404,{error:'Saved example not found'});}
  if(pathname.startsWith('/api/'))return json(403,{error:'此入口只提供已保存报告的只读查看。'});
  const report=pathname.match(/^\/report\/([a-zA-Z0-9_-]+)$/);
  if(report)return byId.has(report[1])?send(200,'text/html; charset=utf-8',app):json(404,{error:'Saved example not found'});
  if(pathname.startsWith('/assets/')){
   const file=path.resolve(frontend,'.'+pathname),relative=path.relative(frontend,file);
   if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(404,{error:'Asset not found'});
   const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'}[path.extname(file)];
   return mime?send(200,mime,fs.readFileSync(file)):json(404,{error:'Asset not found'});
  }
  return json(404,{error:'Read-only saved report viewer'});
 });
}
module.exports={createSavedReportViewer};
if(require.main===module){const [catalog,port='17866']=process.argv.slice(2);if(!catalog)throw Error('Usage: saved-report-viewer.cjs private-catalog.json [port]');const server=createSavedReportViewer({frontend:path.resolve(__dirname,'../frontend/dist'),records:JSON.parse(fs.readFileSync(catalog,'utf8'))});server.listen(Number(port),'127.0.0.1',()=>console.log('只读评分样例：http://127.0.0.1:'+port));server.on('error',e=>{console.error(e.message);process.exitCode=1;});process.on('SIGINT',()=>{server.closeAllConnections();server.close();});}
