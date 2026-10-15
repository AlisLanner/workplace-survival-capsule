const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { exec } = require("child_process");

const appRoot = __dirname;
const prismaDir = path.join(appRoot, "backend", "prisma");
const frontendDist = path.join(appRoot, "frontend", "dist");
const indexHtml = path.join(frontendDist, "index.html");
const configPath = path.join(appRoot, "config.env");

if (fs.existsSync(configPath)) {
  require("dotenv").config({ path: configPath });
}

process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = process.env.PORT || "17863";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
process.env.USE_MOCK_LLM = process.env.USE_MOCK_LLM || "true";
// 便携版数据库必须指向自带的 dev.db（用绝对路径，避免 cwd 解析偏差）
process.env.DATABASE_URL = `file:${path.join(prismaDir, "dev.db").replace(/\\/g, "/")}`;

if (!process.env.ADMIN_SECRET) {
  process.env.ADMIN_SECRET = crypto.randomBytes(24).toString("hex");
  console.log("ADMIN_SECRET was not set. Generated a temporary admin secret for this launch:");
  console.log(process.env.ADMIN_SECRET);
}

if (!fs.existsSync(indexHtml)) {
  console.error("Missing frontend build:", indexHtml);
  process.exit(1);
}

if (!fs.existsSync(path.join(prismaDir, "dev.db"))) {
  console.error("Missing database:", path.join(prismaDir, "dev.db"));
  process.exit(1);
}

process.chdir(prismaDir);

const express = require("express");
const backendApp = require("./backend/dist/src/app").app;

const app = express();

app.use((req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/api/") || req.path.startsWith("/debug/")) {
    backendApp(req, res, next);
    return;
  }
  next();
});

app.use(express.static(frontendDist, { index: false }));

app.get("*", (_req, res) => {
  res.sendFile(indexHtml);
});

function openBrowser(url) {
  if (process.env.NO_OPEN_BROWSER === "1") {
    return;
  }
  exec(`start "" "${url}"`);
}

function listenWithFallback(port, remainingAttempts) {
  const server = app.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log("");
    console.log("Workplace Survival Capsule is running.");
    console.log(`Open: ${url}`);
    console.log("");
    console.log("Keep this window open while using the app.");
    openBrowser(url);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && remainingAttempts > 0) {
      listenWithFallback(port + 1, remainingAttempts - 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });
}

listenWithFallback(Number(process.env.PORT), 20);
