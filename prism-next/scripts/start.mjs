import { cpSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
const root=fileURLToPath(new URL("..",import.meta.url));
const output=join(root,".next","standalone");
const server=join(output,"server.js");
if(!existsSync(server)){console.error("尚未构建，请先运行 pnpm build。");process.exit(1);}
mkdirSync(join(output,".next"),{recursive:true});
cpSync(join(root,"public"),join(output,"public"),{recursive:true});
cpSync(join(root,".next","static"),join(output,".next","static"),{recursive:true});
process.env.PORT=process.env.PORT||"17927";
process.env.BACKEND_ORIGIN=process.env.BACKEND_ORIGIN||"http://127.0.0.1:17877";
process.env.HOSTNAME="127.0.0.1";
process.env.NEXT_TELEMETRY_DISABLED="1";
await import(pathToFileURL(server).href);
