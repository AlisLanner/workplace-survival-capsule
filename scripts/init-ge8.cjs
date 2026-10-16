// Node 24+. Explicit new database only; never seeds or replaces an existing database.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');const repo=path.resolve(__dirname,'..');
const input=process.argv[2];if(!input)throw Error('Usage: node scripts/init-ge8.cjs /absolute/path/to/new.db');
const database=path.resolve(input);if(fs.existsSync(database))throw Error('Database already exists; keep it and use the version installer for an upgrade.');
if(!fs.existsSync(path.dirname(database)))throw Error('Database parent directory must already exist.');
if(!fs.existsSync(path.join(repo,'backend/dist/src/assessment/install.js')))throw Error('Build backend first.');
const env={...process.env,DATABASE_URL:'file:'+database.replaceAll('\\','/')};
const run=(file,args=[])=>cp.execFileSync(process.execPath,[file,...args],{cwd:path.join(repo,'backend'),env,windowsHide:true,stdio:'inherit'});
// On this Windows runtime Prisma deploy requires the empty SQLite file to exist first.
new DatabaseSync(database).close();
run(path.join(repo,'node_modules/prisma/build/index.js'),['migrate','deploy','--schema','prisma/schema.prisma']);
run(path.join(repo,'backend/dist/prisma/seed.js'));run(path.join(repo,'backend/dist/src/assessment/install.js'),['--apply']);
console.log(JSON.stringify({initialized:true,database,mode:'mock by default; real mode is explicit'}));
