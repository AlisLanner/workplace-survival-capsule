import { callDeepSeek, streamDeepSeek } from "../services/llm.service";
import { getPromptContent } from "../services/prompt.service";
import type { AgentName, NpcResult } from "../types/agent";
import { createBoundarySafeNpcResult, findNpcBoundaryViolation } from "../utils/npcBoundaryGuard";
import { parseAgentJSON } from "../utils/parseAgentJSON";
import { log } from "../utils/logger";
import { renderTemplate } from "../utils/renderTemplate";

const promptKeyByAgent: Record<AgentName, string> = {
  leader: "leader",
  coworker: "coworker",
  client: "client"
};
const FALLBACK_VISIBLE_REPLY_CHUNK_SIZE = 12;

function emitVisibleReplyChunks(content: string, onToken: (token: string) => void) {
  for (let index = 0; index < content.length; index += FALLBACK_VISIBLE_REPLY_CHUNK_SIZE) {
    onToken(content.slice(index, index + FALLBACK_VISIBLE_REPLY_CHUNK_SIZE));
  }
}

type MemoryState = {
  primaryLabel: string;
  primaryValue: number;
  pressureLabel: string;
  pressureValue: number;
  lastConcern: string;
  toneGuidance: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function buildNpcMemoryState(agent: AgentName, blackboard: unknown): MemoryState {
  const board = asRecord(blackboard);
  const memories = asRecord(board.npc_memory);
  const memory = asRecord(memories[agent]);

  if (agent === "coworker") {
    const cooperation = asNumber(memory.cooperation, 3);
    const defensiveness = asNumber(memory.defensiveness, 3);
    return {
      primaryLabel: "合作度",
      primaryValue: cooperation,
      pressureLabel: "防御度",
      pressureValue: defensiveness,
      lastConcern: asString(memory.last_concern, "协作边界仍需确认"),
      toneGuidance:
        cooperation <= 2 || defensiveness >= 4
          ? "更防御、更明确划边界，只接受有限配合。"
          : "可以有条件配合，但仍要追问用户怎么承担外部沟通和边界。"
    };
  }

  const trust = asNumber(memory.trust, 3);
  const pressureKey = agent === "client" ? "anxiety" : "pressure";
  const pressureValue = asNumber(memory[pressureKey], 3);
  return {
    primaryLabel: "信任度",
    primaryValue: trust,
    pressureLabel: agent === "client" ? "焦虑度" : "压力强度",
    pressureValue,
    lastConcern: asString(memory.last_concern, agent === "client" ? "客户预期仍需确认" : "方案依据仍需确认"),
    toneGuidance:
      trust <= 2 || pressureValue >= 4
        ? "追问应更尖锐、更不轻易接受，要求用户给出依据和边界。"
        : "可以有条件接受用户的判断，但仍要继续压实风险、预期或下一步。"
  };
}

export async function callNpcAgent(params: {
  agent: AgentName;
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
  npcInstruction: string;
}): Promise<NpcResult> {
  const systemPrompt = await getPromptContent(promptKeyByAgent[params.agent]);
  const memoryState = buildNpcMemoryState(params.agent, params.blackboard);
  const input = renderTemplate(
    `
Instruction:
{npc_instruction}

Current NPC state:
- {primary_label}: {primary_value}/5
- {pressure_label}: {pressure_value}/5
- 上一轮最关心: {last_concern}
- 语气指令: {tone_guidance}

Blackboard:
{blackboard}

Chat history:
{chat_history}

User reply:
{user_message}
`,
    {
      npc_instruction: params.npcInstruction,
      primary_label: memoryState.primaryLabel,
      primary_value: String(memoryState.primaryValue),
      pressure_label: memoryState.pressureLabel,
      pressure_value: String(memoryState.pressureValue),
      last_concern: memoryState.lastConcern,
      tone_guidance: memoryState.toneGuidance,
      blackboard: JSON.stringify(params.blackboard, null, 2),
      chat_history: params.chatHistory,
      user_message: params.userMessage
    }
  );

  const raw = await callDeepSeek({
    systemPrompt,
    userPrompt: input,
    model: process.env.DEEPSEEK_FAST_MODEL,
    temperature: 0.65,
    maxTokens: 900,
    jsonMode: true,
    thinking: false,
    timeoutMs: 90000
  });

  const result = await parseAgentJSON<NpcResult>(raw, systemPrompt, input, `${params.agent} Agent`);
  const violation = findNpcBoundaryViolation(params.agent, result.visible_reply?.content ?? "");
  if (!violation) {
    return result;
  }

  log("warn", "NPC reply violated assessment boundary; retrying once", {
    agent: params.agent,
    violation,
    replyPreview: result.visible_reply?.content?.slice(0, 300)
  });

  const retryInput = `${input}

Boundary correction:
上一版回复违反测评边界，疑似替受试者解决问题或输出标准答案。请重新输出 JSON。
要求：
1. 只追问、质疑、澄清或有条件接受。
2. 不要提出完整解决方案。
3. 不要替用户安排分工。
4. 不要替用户写客户口径。
5. 回复仍为 1-3 句。`;

  const retryRaw = await callDeepSeek({
    systemPrompt,
    userPrompt: retryInput,
    model: process.env.DEEPSEEK_FAST_MODEL,
    temperature: 0.3,
    maxTokens: 900,
    jsonMode: true,
    thinking: false,
    timeoutMs: 90000
  });
  const retryResult = await parseAgentJSON<NpcResult>(retryRaw, systemPrompt, retryInput, `${params.agent} Agent retry`);
  const retryViolation = findNpcBoundaryViolation(params.agent, retryResult.visible_reply?.content ?? "");

  if (!retryViolation) {
    return retryResult;
  }

  log("warn", "NPC retry still violated assessment boundary; using safe fallback reply", {
    agent: params.agent,
    violation: retryViolation,
    replyPreview: retryResult.visible_reply?.content?.slice(0, 300)
  });

  return createBoundarySafeNpcResult(params.agent, params.blackboard);
}

// ── Streaming NPC call ─────────────────────────────────

/**
 * State machine that extracts `visible_reply.content` text
 * from a streaming JSON response so the client can see the
 * NPC reply character by character before the full JSON arrives.
 */
class ContentStreamExtractor {
  private buffer = "";
  private state: "seeking" | "in_content" | "done" = "seeking";
  private contentPattern = /"content"\s*:\s*"/g;
  private lastIndex = 0;

  /** Feed a chunk of raw JSON text; returns any content characters extracted. */
  feed(chunk: string): string {
    if (this.state === "done") return "";

    this.buffer += chunk;
    let output = "";

    if (this.state === "seeking") {
      this.contentPattern.lastIndex = 0;
      const match = this.contentPattern.exec(this.buffer);
      if (match) {
        this.state = "in_content";
        this.lastIndex = match.index + match[0].length;
      }
    }

    if (this.state === "in_content") {
      // Walk forward, tracking escape sequences
      let i = this.lastIndex;
      while (i < this.buffer.length) {
        const ch = this.buffer[i];
        if (ch === "\\") {
          // Skip escaped character but still emit it
          output += this.buffer.slice(this.lastIndex, i + 2);
          i += 2;
          this.lastIndex = i;
          continue;
        }
        if (ch === '"') {
          // Content string ended
          output += this.buffer.slice(this.lastIndex, i);
          this.state = "done";
          this.lastIndex = i;
          break;
        }
        i++;
      }
      if (this.state === "in_content" && i > this.lastIndex) {
        output += this.buffer.slice(this.lastIndex, i);
        this.lastIndex = i;
      }
    }

    return output;
  }

  reset() {
    this.buffer = "";
    this.state = "seeking";
    this.lastIndex = 0;
  }
}

export async function callNpcAgentStreaming(params: {
  agent: AgentName;
  blackboard: unknown;
  chatHistory: string;
  userMessage: string;
  npcInstruction: string;
  onToken: (token: string) => void;
}): Promise<NpcResult> {
  const systemPrompt = await getPromptContent(promptKeyByAgent[params.agent]);
  const memoryState = buildNpcMemoryState(params.agent, params.blackboard);
  const input = renderTemplate(
    `
Instruction:
{npc_instruction}

Current NPC state:
- {primary_label}: {primary_value}/5
- {pressure_label}: {pressure_value}/5
- 上一轮最关心: {last_concern}
- 语气指令: {tone_guidance}

Blackboard:
{blackboard}

Chat history:
{chat_history}

User reply:
{user_message}
`,
    {
      npc_instruction: params.npcInstruction,
      primary_label: memoryState.primaryLabel,
      primary_value: String(memoryState.primaryValue),
      pressure_label: memoryState.pressureLabel,
      pressure_value: String(memoryState.pressureValue),
      last_concern: memoryState.lastConcern,
      tone_guidance: memoryState.toneGuidance,
      blackboard: JSON.stringify(params.blackboard, null, 2),
      chat_history: params.chatHistory,
      user_message: params.userMessage
    }
  );

  const extractor = new ContentStreamExtractor();
  let emittedVisibleContent = "";

  const raw = await streamDeepSeek({
    systemPrompt,
    userPrompt: input,
    model: process.env.DEEPSEEK_FAST_MODEL,
    temperature: 0.65,
    maxTokens: 900,
    jsonMode: true,
    timeoutMs: 90000,
    onToken: (chunk) => {
      const content = extractor.feed(chunk);
      if (content) {
        emittedVisibleContent += content;
        params.onToken(content);
      }
    }
  });

  const result = await parseAgentJSON<NpcResult>(raw, systemPrompt, input, `${params.agent} Agent (streaming)`);
  const violation = findNpcBoundaryViolation(params.agent, result.visible_reply?.content ?? "");
  const finalContent = result.visible_reply?.content ?? "";

  if (!violation) {
    if (!emittedVisibleContent && finalContent) {
      emitVisibleReplyChunks(finalContent, params.onToken);
    }
    return result;
  }

  log("warn", "NPC reply violated assessment boundary; retrying once (streaming fallback)", {
    agent: params.agent,
    violation,
    replyPreview: result.visible_reply?.content?.slice(0, 300)
  });

  // Boundary violation retry — use non-streaming for simplicity
  const retryInput = `${input}

Boundary correction:
上一版回复违反测评边界，疑似替受试者解决问题或输出标准答案。请重新输出 JSON。
要求：
1. 只追问、质疑、澄清或有条件接受。
2. 不要提出完整解决方案。
3. 不要替用户安排分工。
4. 不要替用户写客户口径。
5. 回复仍为 1-3 句。`;

  const retryRaw = await callDeepSeek({
    systemPrompt,
    userPrompt: retryInput,
    model: process.env.DEEPSEEK_FAST_MODEL,
    temperature: 0.3,
    maxTokens: 900,
    jsonMode: true,
    thinking: false,
    timeoutMs: 90000
  });

  const retryResult = await parseAgentJSON<NpcResult>(retryRaw, systemPrompt, retryInput, `${params.agent} Agent retry`);
  const retryViolation = findNpcBoundaryViolation(params.agent, retryResult.visible_reply?.content ?? "");

  if (!retryViolation) {
    // Stream the retry content to the client
    const retryContent = retryResult.visible_reply?.content ?? "";
    emitVisibleReplyChunks(retryContent, params.onToken);
    return retryResult;
  }

  log("warn", "NPC retry still violated assessment boundary; using safe fallback reply", {
    agent: params.agent,
    violation: retryViolation
  });

  const fallback = createBoundarySafeNpcResult(params.agent, params.blackboard);
  const fallbackContent = fallback.visible_reply?.content ?? "";
  emitVisibleReplyChunks(fallbackContent, params.onToken);
  return fallback;
}
