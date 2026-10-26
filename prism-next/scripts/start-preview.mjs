import { createConnection } from "node:net";
import { existsSync, mkdirSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFile } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const logRoot = join(root, "_核对", "预览服务日志");
const noOpen = process.argv.some(arg => ["--no-open", "-noopen"].includes(arg.toLowerCase()));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function listening(port) {
  return new Promise(resolve => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let settled = false;
    const done = value => { if (settled) return; settled = true; socket.destroy(); resolve(value); };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1500, () => done(false));
  });
}
async function ensureService(port, script, name) {
  if (await listening(port)) return;
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const stdout = openSync(join(logRoot, `${name}-${stamp}.stdout.log`), "a");
  const stderr = openSync(join(logRoot, `${name}-${stamp}.stderr.log`), "a");
  const service = spawn(process.execPath, [script], { cwd: root, detached: true, windowsHide: true, stdio: ["ignore", stdout, stderr] });
  let failed;
  service.once("error", error => { failed = error; });
  service.unref();
  closeSync(stdout); closeSync(stderr);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (failed) throw failed;
    if (await listening(port)) return;
    await pause(250);
  }
  throw new Error(`Service ${name} was not ready. See logs in ${logRoot}`);
}

try {
  if (!existsSync(join(root, ".next", "standalone", "server.js"))) throw new Error("Build missing. Run pnpm build first.");
  mkdirSync(logRoot, { recursive: true });
  await ensureService(17926, "scripts/start.mjs", "next");
  await ensureService(17925, "scripts/start-compat.mjs", "bookmark");
  const response = await fetch("http://127.0.0.1:17926/", { signal: AbortSignal.timeout(15000) });
  if (!response.ok || !(await response.text()).includes("MACST")) throw new Error("Preview validation failed.");
  console.log("MACST ready: http://127.0.0.1:17926/");
  console.log("Old bookmark: http://127.0.0.1:17925/ -> current preview");
  if (!noOpen) execFile("rundll32.exe", ["url.dll,FileProtocolHandler", "http://127.0.0.1:17926/"], { windowsHide: true }, error => {
    if (error) console.log("Open http://127.0.0.1:17926/ in your browser.");
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
