import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/services/llm.service", () => ({ callDeepSeek: vi.fn() }));
import { callDeepSeek } from "../src/services/llm.service";
import { canonicalReply, npc } from "../src/assessment/agents";
import { definitions, hash } from "../src/assessment/definitions";
import { initialState } from "../src/assessment/coverage";
import { modelConfig } from "../src/assessment/runtime";
import { composeRoleSpeech, spokenFact } from "../src/assessment/roleSpeech";
import type { Probe, Snapshot } from "../src/assessment/types";

describe("first-person role dialogue preserves required facts and neutral questions", () => {
  beforeEach(() => vi.mocked(callDeepSeek).mockReset());
  it.each(definitions)("keeps roles, numbers, negative constraints and every scheduled fact: $scenario_code", d => {
    const original = JSON.stringify(d);
    for (const agent of ["leader", "coworker", "client"] as const) {
      const facts = [...d.role_facts[agent], ...d.events.filter(e => e.agent === agent).flatMap(e => e.facts)];
      for (const f of facts) {
        const speech = spokenFact(f.text, d.roles[agent].name);
        expect(speech.startsWith("我")).toBe(true);
        expect(speech).not.toContain(d.roles[agent].name);
        expect(speech.match(/\d+(?:\.\d+)?/g) ?? []).toEqual(f.text.match(/\d+(?:\.\d+)?/g) ?? []);
        if (/不能|不可|尚未|未授权|没有批准|尚待/.test(f.text)) expect(speech).toMatch(/不能|不可|尚未|还没有|没有授权|没有批准|尚待/);
      }
    }
    expect(JSON.stringify(d)).toBe(original);
  });
  it("keeps custom facts intact and does not borrow built-in facts by ID or another speaker's identity", () => {
    expect(spokenFact("苏姐本组还有2人可支持。", "苏姐")).toBe("我本组还有2人可支持。");
    expect(spokenFact("苏姐本组已排满，跨组支持需要协商确认。", "陈总")).toContain("苏姐本组已排满");
    expect(spokenFact("本人可拆分任务；跨组借人须苏姐确认。", "陈总", true)).toContain("你可拆分任务；跨组借人须苏姐确认。");
  });
  it("includes each exact required statement/question once when the model has already integrated it", async () => {
    const d=definitions[0], state=initialState(d);
    const probe:Probe={agent:"coworker",facts:[...d.role_facts.coworker,...d.events.filter(e=>e.id.endsWith(":change")).flatMap(e=>e.facts)],questions:["你准备怎么调整？"],slot_ids:[],event_ids:[]};
    const snapshot:Snapshot={schema_version:d.schema_version,definition:d,definition_hash:hash(d),code_sha:"test",prompts:{coworker:{key:"fixture",content:"frozen",hash:hash("frozen")}},prompt_bundle_hash:"fixture",model:{...modelConfig(),mock:false}};
    const canonical=canonicalReply(snapshot,probe);
    vi.mocked(callDeepSeek).mockResolvedValue(JSON.stringify({visible_reply:canonical}));
    expect(await npc(snapshot,state,probe,[])).toEqual(canonical);
    expect(callDeepSeek).toHaveBeenCalledTimes(1);
    const input=JSON.parse(vi.mocked(callDeepSeek).mock.calls[0][0].userPrompt);
    for(const statement of input.speech_style.required_statements) expect(canonical.content.split(statement)).toHaveLength(2);
    expect(canonical.content).not.toContain("苏姐本组");
    expect(canonical.content).not.toContain("苏姐原定");
  });
  it("still delivers omitted required facts and questions without inventing a response", () => {
    const speech=composeRoleSpeech(["我没有批准变更范围。"],["你准备如何确认？"],"我仍有疑问。");
    expect(speech).toBe("我没有批准变更范围。\n我仍有疑问。\n你准备如何确认？");
  });
});
