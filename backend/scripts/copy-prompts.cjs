const fs=require('node:fs');
const path=require('node:path');
const src=path.resolve(__dirname,'../src/prompts');
const dest=path.resolve(__dirname,'../dist/src/prompts');
fs.cpSync(src,dest,{recursive:true});
function check(dir,rel='') { for(const ent of fs.readdirSync(dir,{withFileTypes:true})) { const name=path.join(rel,ent.name); if(ent.isDirectory())check(path.join(dir,ent.name),name); else if(!fs.readFileSync(path.join(src,name)).equals(fs.readFileSync(path.join(dest,name))))throw Error('Prompt build mismatch: '+name); } }
check(src);
console.log('Prompt resources copied and verified.');
