import { createServer } from "node:http";

// Keep bookmarks to the original preview working after the move to Next.js.
const server = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1:17925");
  if (url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ service: "maat-preview-compat", target: "http://127.0.0.1:17926/" }));
    return;
  }
  if (url.pathname === "/favicon.ico") { response.writeHead(204); response.end(); return; }
  const path = /^\/(?:scenarios|assessment|admin)(?:\/|$)/.test(url.pathname) || ["/framework", "/process", "/about"].includes(url.pathname) ? url.pathname : "/";
  const target = `http://127.0.0.1:17926${path}${url.search}`;
  response.writeHead(302, { Location: target, "Cache-Control": "no-store" });
  response.end();
});
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
server.listen(17925, "127.0.0.1", () => console.log("MACST preview bookmark: http://127.0.0.1:17925/ -> http://127.0.0.1:17926/"));
