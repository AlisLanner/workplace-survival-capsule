import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { adminRouter } from "./routes/admin.routes";
import { assessmentRouter } from "./routes/assessment.routes";
import { createRequestId, getLogFilePath, log } from "./utils/logger";

function statusFromError(error: Error): number {
  if (error.message.includes("not found")) {
    return 404;
  }
  if (error.message.includes("required") || error.message.includes("inactive")) {
    return 400;
  }
  if (error.message.includes("finished") || error.message.includes("not been generated")) {
    return 409;
  }
  return 500;
}

function resolveCorsOrigin(): true | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw.trim() === "*") {
    return true;
  }
  return raw.split(",").map((origin) => origin.trim());
}

export const app = express();

app.use(cors({ origin: resolveCorsOrigin() }));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const requestId = req.header("x-request-id") || createRequestId();
  const startedAt = Date.now();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  log("info", "HTTP request started", {
    requestId,
    method: req.method,
    path: req.originalUrl
  });

  res.on("finish", () => {
    log("info", "HTTP request finished", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "llm-multi-agent-workplace-assessment-system-backend" });
});

app.get("/debug/log-path", (_req, res) => {
  res.json({ logFile: getLogFilePath() });
});

app.use("/api/assessment", assessmentRouter);
app.use("/api/admin", adminRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const message = error instanceof Error ? error.message : "Internal server error";
  const status = error instanceof Error ? statusFromError(error) : 500;
  log("error", "HTTP request failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    error
  });
  res.status(status).json({ error: message, requestId: req.requestId });
};

app.use(errorHandler);
