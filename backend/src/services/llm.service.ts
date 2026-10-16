import "dotenv/config";
import { mockDeepSeekResponse } from "./mockLlm.service";
import { createRequestId, log } from "../utils/logger";

type CallDeepSeekParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  thinking?: boolean;
  timeoutMs?: number;
  allowMockFallback?: boolean;
  baseUrl?: string;
  maxAttempts?: number;
  onUsage?: (usage:Record<string,unknown>|null)=>void;
  mockMode?: boolean;
};

type StreamCallback = (token: string) => void;
const FALLBACK_STREAM_CHUNK_SIZE = 24;

function emitTextChunks(text: string, onToken: StreamCallback, chunkSize = FALLBACK_STREAM_CHUNK_SIZE) {
  for (let index = 0; index < text.length; index += chunkSize) {
    onToken(text.slice(index, index + chunkSize));
  }
}

// ── Prompt caching ─────────────────────────────────────
// Wrap the system prompt in a content array so the model
// provider can cache it across calls when byte-identical.

function buildSystemMessage(systemPrompt: string) {
  // Try structured format with cache hint; falls back gracefully
  // for providers that don't support cache_control.
  return [
    {
      type: "text" as const,
      text: systemPrompt,
      cache_control: { type: "ephemeral" as const }
    }
  ];
}

function ensureJsonInstruction(systemPrompt: string, userPrompt: string, jsonMode: boolean): string {
  if (!jsonMode || /json/i.test(`${systemPrompt}\n${userPrompt}`)) {
    return systemPrompt;
  }
  return `${systemPrompt}\n\nRespond with a JSON object only.`;
}

// ── Non-streaming call ─────────────────────────────────

async function requestDeepSeek(params: Required<CallDeepSeekParams>): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const callId = createRequestId("llm");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  const startedAt = Date.now();

  try {
    const systemPrompt = ensureJsonInstruction(params.systemPrompt, params.userPrompt, params.jsonMode);
    const body: Record<string, unknown> = {
      model: params.model,
      messages: [
        { role: "system", content: buildSystemMessage(systemPrompt) },
        { role: "user", content: params.userPrompt }
      ],
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream: false
    };

    if (params.jsonMode) {
      body.response_format = { type: "json_object" };
    }
    // thinking 默认值：仅当明确开启时启用推理；否则显式 disabled，避免思考模型误开思考
    // （deepseek-v4-flash 在未传 thinking 时可能默认思考，导致 content 被 reasoning 占满）
    body.thinking = params.thinking ? { type: "enabled" } : { type: "disabled" };

    log("info", "DeepSeek request started", {
      callId,
      model: params.model,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      timeoutMs: params.timeoutMs,
      inputChars: params.userPrompt.length
    });

    const baseUrl = params.baseUrl || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
      usage?: Record<string, unknown>;
    };
    params.onUsage(data.usage??null);
    // deepseek-v4-flash 等思考模型可能把内容放在 reasoning_content、content 为空，
    // 此时退化用 reasoning_content 提取（下游 safeParseJSON 会抓取最外层 JSON）。
    const content =
      data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || "";
    if (!content) {
      throw new Error(`Empty DeepSeek response: ${JSON.stringify(data)}`);
    }

    log("info", "DeepSeek request finished", {
      callId,
      model: params.model,
      durationMs: Date.now() - startedAt,
      outputChars: content.length
      ,usage: data.usage ?? "unknown"
    });

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callDeepSeek({
  systemPrompt,
  userPrompt,
  model,
  temperature = 0.7,
  maxTokens = 1200,
  jsonMode = true,
  thinking = false,
  timeoutMs = 90000,
  allowMockFallback = true,
  baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  maxAttempts = 2,
  onUsage = ()=>{},
  mockMode = process.env.USE_MOCK_LLM === "true"
}: CallDeepSeekParams): Promise<string> {
  const selectedModel =
    model ||
    (thinking
      ? process.env.DEEPSEEK_STRONG_MODEL || process.env.DEEPSEEK_FAST_MODEL || "deepseek-v4-flash"
      : process.env.DEEPSEEK_FAST_MODEL || "deepseek-v4-flash");
  const useExplicitMock = mockMode;
  const hasApiKey = Boolean(process.env.DEEPSEEK_API_KEY);
  // 用户已明确配置 API key（要真实 LLM）时，禁用 mock 降级——失败直接抛错，不静默转 mock。
  // 仅在显式开启 mock，或完全未配置 key 且允许降级（教学演示）时才走 mock。
  const useMock = useExplicitMock || (!hasApiKey && allowMockFallback);

  if (useMock) {
    return mockDeepSeekResponse(systemPrompt, userPrompt);
  }
  if (!hasApiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const normalizedParams: Required<CallDeepSeekParams> = {
    systemPrompt,
    userPrompt,
    model: selectedModel,
    temperature,
    maxTokens,
    jsonMode,
    thinking,
    timeoutMs,
    allowMockFallback,
    baseUrl,
    maxAttempts,
    onUsage,
    mockMode
  };

  try {
    return await requestDeepSeek(normalizedParams);
  } catch (error) {
    if (maxAttempts <= 1) throw error;
    log("warn", "DeepSeek call failed; retrying once", { error });
    try {
      return await requestDeepSeek(normalizedParams);
    } catch (retryError) {
      // 用户已配置 API key 时，禁止静默降级 mock——必须让失败可见，避免"真→假"割裂
      if (hasApiKey || !allowMockFallback) {
        log("error", "DeepSeek retry failed; mock fallback disabled", { error: retryError });
        throw retryError;
      }
      log("warn", "DeepSeek retry failed; falling back to local mock agent", { error: retryError });
      return mockDeepSeekResponse(systemPrompt, userPrompt);
    }
  }
}

// ── Streaming call ─────────────────────────────────────

export async function streamDeepSeek({
  systemPrompt,
  userPrompt,
  model,
  temperature = 0.65,
  maxTokens = 900,
  jsonMode = true,
  timeoutMs = 90000,
  onToken
}: CallDeepSeekParams & { onToken: StreamCallback }): Promise<string> {
  const useMock = process.env.USE_MOCK_LLM === "true" || !process.env.DEEPSEEK_API_KEY;

  if (useMock) {
    // Mock: simulate streaming without flooding the SSE connection.
    const full = await mockDeepSeekResponse(systemPrompt, userPrompt);
    emitTextChunks(full, onToken);
    return full;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const selectedModel =
    model ||
    process.env.DEEPSEEK_FAST_MODEL ||
    "deepseek-v4-flash";

  const callId = createRequestId("lls");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const systemPromptForRequest = ensureJsonInstruction(systemPrompt, userPrompt, jsonMode);
    const body: Record<string, unknown> = {
      model: selectedModel,
      messages: [
        { role: "system", content: buildSystemMessage(systemPromptForRequest) },
        { role: "user", content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true }
    };

    // 关键：流式调用也必须显式关闭思考，否则 deepseek-v4-flash 默认思考，
    // 返回的是 reasoning_content（思考文本）而非 JSON content，导致下游解析失败降级 mock。
    body.thinking = { type: "disabled" };

    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    log("info", "DeepSeek stream started", {
      callId, model: selectedModel, maxTokens, inputChars: userPrompt.length
    });

    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek stream ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const msg = parsed.choices?.[0]?.delta || {};
          // 思考已在请求中禁用（body.thinking = disabled），content 即标准 JSON。
          // 不取 reasoning_content——那是思考文本，拼接后不是合法 JSON，会导致解析失败。
          const delta = msg.content;
          if (delta) {
            fullContent += delta;
            onToken(delta);
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }

    log("info", "DeepSeek stream finished", {
      callId, model: selectedModel, durationMs: Date.now() - startedAt, outputChars: fullContent.length
    });

    return fullContent;
  } catch (error) {
    log("warn", "DeepSeek stream failed; falling back to non-streaming", { error });
    clearTimeout(timeout);
    // Fall back to non-streaming
    const full = await callDeepSeek({ systemPrompt, userPrompt, model, temperature, maxTokens, jsonMode, timeoutMs });
    emitTextChunks(full, onToken);
    return full;
  } finally {
    clearTimeout(timeout);
  }
}
