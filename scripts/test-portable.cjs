const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const output = path.resolve(process.argv[2] || "portable-release/windows-test");
const child = spawn(path.join(output, "runtime", "node.exe"), [path.join(output, "app", "server.cjs")], {
  cwd: path.join(output, "app"), windowsHide: true,
  env: { ...process.env, NO_OPEN_BROWSER: "1", USE_MOCK_LLM: "true", DEEPSEEK_API_KEY: "", ADMIN_SECRET: "", PORT: "18950" },
  stdio: ["ignore", "pipe", "pipe"]
});
let log = "";
child.stdout.on("data", (data) => { log += data.toString(); });
child.stderr.on("data", (data) => { log += data.toString(); });

async function main() {
  let base;
  for (let attempt = 0; attempt < 200; attempt++) {
    base = log.match(/Open: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
    if (base) break;
    if (child.exitCode !== null) throw new Error("Portable server exited before startup.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(base, "Portable server did not start.");
  async function request(route, body) {
    const response = await fetch(base + route, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000)
    });
    assert(response.ok, `${route} returned ${response.status}`);
    return response;
  }
  assert((await (await request("/health")).json()).ok);
  const html = await (await request("/")).text();
  assert(html.includes('<div id="root">'));
  for (const asset of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
    await request(asset[1]);
  }
  const unauthorized = await fetch(base + "/api/admin/dashboard");
  assert.equal(unauthorized.status, 401);
  const scenarios = await (await request("/api/assessment/scenarios")).json();
  assert.equal(scenarios.length, 5);
  for (const scenario of scenarios) {
    const start = await (await request("/api/assessment/start", { scenario_id: scenario.id })).json();
    assert(start.session_id);
    const turn = await (await request("/api/assessment/message", {
      session_id: start.session_id,
      content: "I will confirm the facts, agree on responsibilities, define the immediate scope, and prepare a fallback plan."
    })).json();
    assert.equal(turn.round, 1);
    const stream = await (await request("/api/assessment/message/stream", {
      session_id: start.session_id, content: "__ASSESSMENT_TIME_EXPIRED__"
    })).text();
    assert(!stream.includes("event: error"), "SSE returned an error.");
    assert(stream.includes("event: done"), "SSE did not complete.");
    const report = await (await request(`/api/assessment/report/${start.session_id}`)).json();
    assert.equal(report.report_status, "unratable");
    console.log("PASS scenario, turn, SSE, timeout report:", scenario.id);
  }
  const start = await (await request("/api/assessment/start", { scenario_id: scenarios[0].id })).json();
  let finished = false;
  for (let round = 0; round < scenarios[0].maxRound; round++) {
    const turn = await (await request("/api/assessment/message", {
      session_id: start.session_id,
      content: "I will verify facts, assign owners and deadlines, negotiate capacity, set delivery boundaries, and prepare a fallback with review checkpoints."
    })).json();
    if (turn.finished) { finished = true; break; }
  }
  assert(finished, "Full mock assessment did not finish.");
  const report = await (await request(`/api/assessment/report/${start.session_id}`)).json();
  assert.equal(report.mock_generated, true);
  console.log("PASS complete mock assessment and Judge report.");
  console.log("PASS bundled runtime, frontend assets, health, admin authentication.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (child.exitCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
});
