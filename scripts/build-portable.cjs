const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const release = path.join(root, "portable-release");
const output = path.join(release, process.argv[2] || `windows-${Date.now()}`);
if (path.dirname(output) !== release || fs.existsSync(output)) {
  throw new Error("Output must be a new directory directly under portable-release.");
}
const app = path.join(output, "app");
const backend = path.join(app, "backend");
const runtime = path.join(release, "runtime", "node.exe");
if (!fs.existsSync(runtime)) throw new Error(`Missing Windows Node runtime: ${runtime}`);

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, dereference: true });
}

function run(script, args, env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: path.join(root, "backend"),
    env: { ...process.env, ...env },
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${script}`);
}

// Preserve Node's nested dependency layout rather than flattening versions.
const visited = new Set();
function collect(name, from, optional = false) {
  let dir = from;
  let source;
  while (true) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      source = candidate;
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (!source) {
    if (optional) return;
    throw new Error(`Missing dependency ${name} from ${from}`);
  }
  if (visited.has(source)) return;
  visited.add(source);
  const relative = path.relative(root, source);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Dependency outside project: ${source}`);
  }
  copy(source, path.join(app, relative));
  const pkg = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"));
  for (const dependency of Object.keys(pkg.dependencies || {})) {
    collect(dependency, source, dependency in (pkg.optionalDependencies || {}));
  }
  for (const dependency of Object.keys(pkg.optionalDependencies || {})) {
    collect(dependency, source, true);
  }
  for (const dependency of Object.keys(pkg.peerDependencies || {})) {
    collect(dependency, source, Boolean(pkg.peerDependenciesMeta?.[dependency]?.optional));
  }
}

async function main() {
  for (const name of ["START.bat", "START_NO_BROWSER.bat", "README.txt"]) {
    copy(path.join(release, name), path.join(output, name));
  }
  copy(runtime, path.join(output, "runtime", "node.exe"));
  copy(path.join(release, "app", "server.cjs"), path.join(app, "server.cjs"));
  copy(path.join(root, "frontend", "dist"), path.join(app, "frontend", "dist"));
  copy(path.join(root, "backend", "dist", "src"), path.join(backend, "dist", "src"));
  copy(path.join(root, "backend", "src", "prompts"), path.join(backend, "dist", "src", "prompts"));
  copy(path.join(root, "backend", "package.json"), path.join(backend, "package.json"));
  copy(path.join(root, "backend", "prisma", "schema.prisma"), path.join(backend, "prisma", "schema.prisma"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "backend", "package.json"), "utf8"));
  for (const name of Object.keys(pkg.dependencies)) collect(name, path.join(root, "backend"));
  copy(path.join(root, "node_modules", ".prisma"), path.join(app, "node_modules", ".prisma"));

  fs.writeFileSync(path.join(app, "config.env"), [
    "USE_MOCK_LLM=true", "DEEPSEEK_API_KEY=", "ADMIN_SECRET=",
    "DEEPSEEK_BASE_URL=https://api.deepseek.com",
    "DEEPSEEK_FAST_MODEL=deepseek-v4-flash", "DEEPSEEK_STRONG_MODEL=deepseek-v4-pro",
    "DEEPSEEK_JUDGE_MODEL=deepseek-v4-flash", "CORS_ORIGIN=http://127.0.0.1:17863",
    "PORT=17863", ""
  ].join("\r\n"));
  const database = path.join(backend, "prisma", "dev.db");
  const env = {
    DATABASE_URL: `file:${database.replace(/\\/g, "/")}`,
    USE_MOCK_LLM: "true", DEEPSEEK_API_KEY: "", ADMIN_SECRET: ""
  };
  run(path.join(root, "node_modules", "prisma", "build", "index.js"), [
    "db", "push", "--skip-generate", "--schema", path.join(backend, "prisma", "schema.prisma")
  ], env);
  run(path.join(root, "backend", "dist", "prisma", "seed.js"), [], env);
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { PrismaClient } = require(path.join(root, "node_modules", "@prisma", "client"));
  const db = new PrismaClient();
  try {
    const counts = {};
    for (const model of ["user", "assessmentSession", "message", "agentGroupDiscussion", "agentTraceEvent", "scenario", "promptTemplate"]) {
      counts[model] = await db[model].count();
    }
    if (["user", "assessmentSession", "message", "agentGroupDiscussion", "agentTraceEvent"].some((key) => counts[key] !== 0)) {
      throw new Error("Release database contains user data.");
    }
    if (counts.scenario !== 5 || counts.promptTemplate !== 8) throw new Error("Incomplete seed data.");
    fs.writeFileSync(path.join(output, "build-manifest.json"), JSON.stringify({
      builtAt: new Date().toISOString(), sourceCommit: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(),
      includesWorkingTree: Boolean(spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout.trim()),
      runtime: spawnSync(runtime, ["--version"], { encoding: "utf8" }).stdout.trim(),
      dependencyPackages: visited.size, databaseCounts: counts
    }, null, 2));
    console.log("Portable build:", output);
    console.log("Clean database:", JSON.stringify(counts));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
