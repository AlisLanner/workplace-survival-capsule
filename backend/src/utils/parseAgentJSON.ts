import { mockDeepSeekResponse } from "../services/mockLlm.service";
import { log } from "./logger";
import { safeParseJSON } from "./safeParseJSON";

export async function parseAgentJSON<T>(
  raw: string,
  systemPrompt: string,
  userPrompt: string,
  agentName: string
): Promise<T> {
  try {
    return safeParseJSON<T>(raw);
  } catch (error) {
    // 已配置 API key（要真实 LLM）时禁止静默降级 mock：
    // 否则一次解析失败就会把后续对话切成 mock 台词，用户看到的"真实/模拟"会中途割裂。
    // 与 llm.service.ts 的降级闸门保持一致——失败必须可见。
    if (process.env.DEEPSEEK_API_KEY) {
      log("error", `${agentName} returned invalid JSON; mock fallback disabled (API key configured)`, {
        error,
        rawPreview: raw.slice(0, 1000)
      });
      throw error;
    }

    log("warn", `${agentName} returned invalid JSON; falling back to local mock agent`, {
      error,
      rawPreview: raw.slice(0, 1000)
    });
    const fallback = await mockDeepSeekResponse(systemPrompt, userPrompt);
    return safeParseJSON<T>(fallback);
  }
}
