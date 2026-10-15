-- CreateTable
CREATE TABLE "AgentTraceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "payloadJson" TEXT,
    "elapsedMs" INTEGER,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentTraceEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgentTraceEvent_sessionId_sequence_idx" ON "AgentTraceEvent"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "AgentTraceEvent_runId_idx" ON "AgentTraceEvent"("runId");
