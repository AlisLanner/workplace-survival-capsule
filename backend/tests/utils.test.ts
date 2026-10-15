import { describe, expect, it } from "vitest";
import { parseAgentJSON } from "../src/utils/parseAgentJSON";
import { renderTemplate } from "../src/utils/renderTemplate";
import { safeParseJSON } from "../src/utils/safeParseJSON";

describe("utils", () => {
  it("parses plain JSON", () => {
    expect(safeParseJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped by extra text", () => {
    expect(safeParseJSON('prefix {"a":1} suffix')).toEqual({ a: 1 });
  });

  it("renders template variables", () => {
    expect(renderTemplate("Hello {name}", { name: "小明" })).toBe("Hello 小明");
  });

  it("falls back to mock agent when model JSON is truncated", async () => {
    const result = await parseAgentJSON<{ active_agent: string }>(
      '{"active_agent":"leader","avoid',
      "你是“基于LLM Multi-Agent的职场情境能力评估系统”中的导演 Agent（Director）。",
      "User reply:\n今晚我负责核心链路，并准备人工短信兜底。",
      "Director Agent"
    );

    expect(result.active_agent).toBeTruthy();
  });
});
