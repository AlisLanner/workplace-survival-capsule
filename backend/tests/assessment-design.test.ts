import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildNpcMemoryState } from "../src/agents/npc.agent";
import { createInitialBlackboard } from "../src/services/blackboard.service";
import {
  buildFallbackNpcInstruction,
  normalizeDirectorResult,
  resolveGroupDiscussionCorrection
} from "../src/services/orchestrator.service";
import { getScenarioRubric } from "../src/services/rubric.service";
import { mockDeepSeekResponse } from "../src/services/mockLlm.service";
import { shouldForceGroupDiscussion } from "../src/utils/groupDiscussionTrigger";
import { createBoundarySafeNpcResult, findNpcBoundaryViolation } from "../src/utils/npcBoundaryGuard";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf-8");
}

function readPrompt(fileName: string): string {
  return readRepoFile(`src/prompts/${fileName}`);
}

describe("assessment design", () => {
  it("initializes a fixed moderate scenario without dense time-management requirements", () => {
    const blackboard = createInitialBlackboard();

    expect(blackboard.min_round).toBe(8);
    expect(blackboard.max_round).toBe(15);
    expect(blackboard.current_focus).toContain("下午4点");
    expect(blackboard.scenario_facts.known_facts).toContain("汇报材料需要区分确认项、假设项、负责人和风险说明。");
    expect(blackboard.scenario_facts.unknowns).toContain("苏姐团队能支持到什么程度未知。");
    expect(getScenarioRubric("project_demo_crisis").requiredElements).toContain("协作方资源负载、交换条件和责任边界");
    expect(blackboard.user_progress).toHaveProperty("used_given_facts", false);
    expect(blackboard.user_progress).toHaveProperty("proposed_viable_alternative", false);
    expect(blackboard.latest_user_behavior).toHaveProperty("unsupported_assumption", false);
  });

  it("initializes the restaurant complaint scenario with scenario-specific roles", () => {
    const blackboard = createInitialBlackboard(10, "coffee_shop_complaint");

    expect(blackboard.scenario_facts.user_role).toContain("值班经理");
    expect(blackboard.scenario_facts.known_facts).toContain("8号桌是重要客人宴请，现场体验和后续合作氛围都受到影响。");
    expect(blackboard.scenario_facts.capability_dimensions).toEqual(["利害识别", "现场止损", "规则边界", "承诺边界", "面子修复", "员工修复", "后厨协同", "系统改进"]);
    expect(blackboard.scenario_facts.agent_profiles.leader.name).toBe("刘总");
    expect(blackboard.scenario_facts.agent_profiles.coworker.name).toBe("小林");
    expect(blackboard.scenario_facts.agent_profiles.client.name).toBe("江师傅");
    expect(getScenarioRubric("coffee_shop_complaint").requiredElements).toContain("现场影响控制和可见补救方式");
    expect(blackboard.conversation_control.last_active_agent).toBe("leader");
  });

  it("initializes the first-week entry-level scenario with entry-level dimensions", () => {
    const blackboard = createInitialBlackboard(10, "first_week_assignment");

    expect(blackboard.scenario_facts.user_role).toContain("运营组入职第一周");
    expect(blackboard.scenario_facts.capability_dimensions).toEqual(["需求澄清", "优先级判断", "横向协作", "诚实沟通", "边界表达", "向上同步", "压力表达", "担当推进"]);
    expect(blackboard.scenario_facts.agent_profiles.leader.name).toBe("许主管");
    expect(blackboard.scenario_facts.agent_profiles.coworker.name).toBe("大周");
    expect(blackboard.scenario_facts.agent_profiles.client.name).toBe("方姐");
    expect(getScenarioRubric("first_week_assignment").requiredElements).toContain("需求口径与截止确认");
    expect(blackboard.unresolved_items).toContain("需求口径与数据权限未确认");
    expect(blackboard.coverage_state?.slots ? Object.keys(blackboard.coverage_state.slots).length : 0).toBe(16);
  });

  it("builds fallback NPC rotation instructions from the active scenario facts", () => {
    const demoBlackboard = createInitialBlackboard(10, "project_demo_crisis");
    const restaurantBlackboard = createInitialBlackboard(10, "coffee_shop_complaint");

    const demoInstruction = buildFallbackNpcInstruction("client", demoBlackboard);
    const restaurantInstruction = buildFallbackNpcInstruction("coworker", restaurantBlackboard);

    expect(demoInstruction).toContain("小秋");
    expect(demoInstruction).toContain("自身处境");
    expect(restaurantInstruction).toContain("小林");
    expect(restaurantInstruction).toContain("边界、责任或预期");
    expect(restaurantInstruction).not.toContain("陈总");
    expect(restaurantInstruction).not.toContain("设计稿");
  });

  it("keeps fallback NPC instructions from exposing answer-like unresolved items", () => {
    const demoBlackboard = createInitialBlackboard(10, "project_demo_crisis");
    demoBlackboard.unresolved_items = ["陈总汇报风险说明未确认", "小秋设计标准未给"];

    const restaurantBlackboard = createInitialBlackboard(10, "coffee_shop_complaint");
    restaurantBlackboard.unresolved_items = ["退款规则未确认", "前厅后厨流程方案未确认"];

    const demoInstruction = buildFallbackNpcInstruction("client", demoBlackboard);
    const restaurantInstruction = buildFallbackNpcInstruction("client", restaurantBlackboard);

    expect(demoInstruction).toContain("小秋");
    expect(demoInstruction).not.toContain("陈总汇报风险说明未确认");
    expect(demoInstruction).not.toContain("小秋设计标准未给");
    expect(restaurantInstruction).toContain("江师傅");
    expect(restaurantInstruction).not.toContain("退款规则未确认");
    expect(restaurantInstruction).not.toContain("前厅后厨流程方案未确认");
  });

  it("normalizes incomplete Director output before the NPC node runs", () => {
    const blackboard = createInitialBlackboard(10, "project_demo_crisis");

    const normalized = normalizeDirectorResult({ active_agent: "client" }, blackboard);

    expect(normalized.active_agent).toBe("client");
    expect(normalized.phase).toBe(blackboard.phase);
    expect(normalized.pressure_level).toBe(blackboard.pressure_level);
    expect(normalized.current_focus).toBe(blackboard.current_focus);
    expect(normalized.npc_instruction).toContain("小秋");
    expect(normalized.npc_instruction).toContain("不提示标准答案");
    expect(normalized.dimension_evidence).toEqual([]);
  });

  it("extracts NPC memory into explicit tone state", () => {
    const blackboard = createInitialBlackboard(10, "project_demo_crisis");
    blackboard.npc_memory.client = {
      trust: 1,
      anxiety: 5,
      last_concern: "担心明天看不到稳定范围",
      observed_user_signal: "vague_scope",
      response_mode: "request_standard_or_process_boundary"
    };

    const memoryState = buildNpcMemoryState("client", blackboard);

    expect(memoryState.primaryLabel).toBe("信任度");
    expect(memoryState.primaryValue).toBe(1);
    expect(memoryState.pressureLabel).toBe("焦虑度");
    expect(memoryState.pressureValue).toBe(5);
    expect(memoryState.lastConcern).toContain("稳定范围");
    expect(memoryState.toneGuidance).toContain("更尖锐");
  });

  it("keeps group discussion protective when no correction is needed", () => {
    expect(resolveGroupDiscussionCorrection({ no_change: true })).toEqual({ changed: false });

    const correction = resolveGroupDiscussionCorrection({
      no_change: false,
      correction: {
        next_agent: "client",
        instruction: "只追问客户预期，不给完整方案",
        blackboard_patch: { current_focus: "客户预期管理" }
      }
    });

    expect(correction.changed).toBe(true);
    expect(correction.nextAgent).toBe("client");
    expect(correction.blackboardPatch).toEqual({ current_focus: "客户预期管理" });
  });

  it("forces group discussion when assessment signals need internal calibration", () => {
    expect(
      shouldForceGroupDiscussion({
        round: 1,
        latest_user_behavior: { avoidance: true }
      })
    ).toBe(true);

    expect(
      shouldForceGroupDiscussion({
        round: 1,
        unresolved_items: ["scope", "risk", "owner", "client"]
      })
    ).toBe(true);

    expect(
      shouldForceGroupDiscussion({
        round: 4,
        min_round: 8,
        user_progress: { final_plan_complete: false }
      })
    ).toBe(true);

    expect(
      shouldForceGroupDiscussion({
        round: 2,
        unresolved_items: ["scope", "risk", "owner", "client"],
        group_discussion_summary: { round_1: {} }
      })
    ).toBe(false);
  });

  it("keeps the visible scenario card concise and non-instructional", () => {
    const seed = readRepoFile("prisma/seed.ts");
    const assessmentService = readRepoFile("src/services/assessment.service.ts");

    expect(seed).toContain("下午 1:30，距 4 点汇报还有两个半小时");
    expect(seed).toContain("数据齐了、框架有了，唯独没法上会");
    expect(seed).toContain("刘总在等一个说法");
    expect(seed).toContain("openingMessageJson");
    expect(seed).toContain("initialBlackboardJson");
    expect(seed).not.toContain("你是谁：");
    expect(seed).not.toContain("已知事实：");
    expect(seed).not.toContain("最终方案");
    expect(seed).not.toContain("记住：");
    expect(seed).not.toContain("顺序不能错");
    expect(seed).not.toContain("接下来你会分别遇到三个人");
    expect(seed).not.toContain("现在你需要同时处理三道难题");
    expect(seed).not.toContain("白手起家");
    expect(seed).not.toContain("三千万");
    expect(assessmentService).not.toContain("任务卡里的事实");
    expect(assessmentService.includes("openingMessage" + "ByScenario")).toBe(false);
    expect(assessmentService).toContain("resolveOpeningMessage");
  });

  it("prompts keep NPCs assessment-neutral and scenario-specific", () => {
    const director = readPrompt("director.prompt.txt");
    const leader = readPrompt("leader.prompt.txt");
    const coworker = readPrompt("coworker.prompt.txt");
    const client = readPrompt("client.prompt.txt");
    const group = readPrompt("group-discussion.prompt.txt");
    const judge = readPrompt("judge.prompt.txt");

    // Director: reads situation + updates NPC states
    expect(director).toContain("Director Agent");
    expect(director).toContain("dimension_evidence");
    expect(director).toContain("不输出 npc_states");
    // Leader: dual-scenario narrative persona
    expect(leader).toContain("leader NPC");
    expect(leader).toContain("场景A");
    expect(leader).toContain("场景B");
    expect(leader).toContain("因果攻略");
    expect(leader).toContain("observed_user_signal");
    expect(leader).toContain("response_mode");
    expect(leader).not.toContain('"state"');
    expect(leader).not.toContain('"relationship"');
    // Coworker: dual-scenario narrative persona
    expect(coworker).toContain("coworker NPC");
    expect(coworker).toContain("场景A");
    expect(coworker).toContain("场景B");
    // Client: dual-scenario narrative persona
    expect(client).toContain("client NPC");
    expect(client).toContain("场景A");
    expect(client).toContain("场景B");
    // Group: conflict resolution
    expect(group).toContain("内部评估");
    expect(group).toContain("no_change: true");
    // Judge: 8-dimension scoring per scenario
    expect(judge).toContain("Judge Agent");
    expect(judge).toContain("八维度分数之和");
    expect(judge).toContain("160");
    expect(`${coworker}\n${client}`).not.toMatch(/^> .*?(说到点子上|顺序对了|标准答案)/m);
  });

  it("judge prompt penalizes unsupported assumptions and keeps radar scores consistent", () => {
    const judge = readPrompt("judge.prompt.txt");

    expect(judge).toContain("八维度分数之和");
    expect(judge).toContain("radar_chart_data");
  });

  it("mock BehaviorDetector emits diagnosis with evidence while StageDirector emits orchestration only", async () => {
    const behaviorPrompt = readPrompt("behavior-detector.prompt.txt");
    const stagePrompt = readPrompt("stage-director.prompt.txt");
    const detectorRaw = await mockDeepSeekResponse(
      behaviorPrompt,
      `
Blackboard:
{}

Chat history:
陈总：下午4点汇报，哪些数据confirm过？

User reply:
三件confirm过，两件标注assumption，设计缺口准备找苏姐谈。
`
    );
    const detector = JSON.parse(detectorRaw);

    expect(detector.detected_behavior.clarified_scope).toBe(true);
    expect(detector.detected_behavior.gave_risk_plan).toBe(true);
    expect(detector.evidence.length).toBeGreaterThan(0);

    const stageRaw = await mockDeepSeekResponse(
      stagePrompt,
      `
Behavior detection:
${JSON.stringify(detector, null, 2)}

Blackboard:
{
  "round": 2,
  "user_progress": {
    "clarified_scope": true,
    "gave_risk_plan": true,
    "handled_coworker_conflict": false,
    "managed_client_expectation": false
  },
  "conversation_control": {
    "last_active_agent": "leader"
  }
}

Chat history:
陈总：下午4点汇报，哪些数据confirm过？

User reply:
三件confirm过，两件标注assumption，设计缺口准备找苏姐谈。
`
    );
    const stage = JSON.parse(stageRaw);

    expect(stage.active_agent).toBe("coworker");
    expect(stage.detected_behavior).toBeUndefined();
    expect(stage.npc_instruction).toBeTruthy();
  });

  it("mock judge credits viable alternatives without polarizing scores", async () => {
    const judgePrompt = readPrompt("judge.prompt.txt");
    const raw = await mockDeepSeekResponse(
      judgePrompt,
      `
Full chat:
用户：三件数据确认过两件标注假设。找苏姐谈小葛借两天，条件是我Q3帮她cover两个需求；小秋给三个VI底线标准让他先出框架。

Final Blackboard:
${JSON.stringify({
        scenario_facts: { capability_dimensions: ["信息辨别", "交付切分", "备选方案", "承诺边界", "向上对齐", "横向协商", "新人赋能", "压力表达"] },
        user_progress: {
          identified_core_flow: true,
          clarified_scope: true,
          asked_clarifying_questions: true,
          proposed_viable_alternative: true,
          gave_owner: true,
          gave_risk_plan: true,
          handled_coworker_conflict: true,
          managed_client_expectation: true
        },
        latest_user_behavior: {
          over_promise: false,
          blame_shifting: false,
          avoidance: false,
          premature_solution: false,
          unsupported_assumption: false,
          honest_risk_with_fallback: true,
          takes_ownership: true,
          pressure_resistant: true
        },
        evaluation_notes: { strengths: [], risks: [], evidence: [] }
      }, null, 2)}

Group summary:
{}
`
    );
    const result = JSON.parse(raw);

    expect(result.dimension_scores["备选方案"]).toBeGreaterThanOrEqual(14);
    expect(result.dimension_scores["横向协商"]).toBeGreaterThanOrEqual(14);
    expect(result.total_score).toBeGreaterThanOrEqual(120);
    expect(result.total_score).toBeLessThanOrEqual(145);
    expect(result.strengths.join("")).toContain("备选");
  });

  it("mock judge does not over-score vague service recovery answers", async () => {
    const judgePrompt = readPrompt("judge.prompt.txt");
    const raw = await mockDeepSeekResponse(
      judgePrompt,
      `
Full chat:
用户：我会先安抚顾客，跟他说不好意思，然后我们会处理一下，也会跟员工沟通，尽量不要影响门店。

Final Blackboard:
${JSON.stringify(createInitialBlackboard(10, "coffee_shop_complaint"), null, 2)}

Group summary:
{}
`
    );
    const result = JSON.parse(raw);

    expect(result.total_score).toBeLessThanOrEqual(65);
    expect(result.dimension_scores["利害识别"]).toBeLessThanOrEqual(12);
    expect(result.dimension_scores["面子修复"]).toBeLessThanOrEqual(12);
  });

  it("mock judge rewards complete service recovery but keeps high score threshold strict", async () => {
    const judgePrompt = readPrompt("judge.prompt.txt");
    const bb = createInitialBlackboard(10, "coffee_shop_complaint");
    // Simulate a strong round-9 response with solid behavior flags
    bb.latest_user_behavior = {
      over_promise: false,
      blame_shifting: false,
      avoidance: false,
      premature_solution: false,
      unsupported_assumption: false,
      honest_risk_with_fallback: true,
      takes_ownership: true,
      pressure_resistant: true
    };
    bb.user_progress = {
      identified_core_flow: true,
      clarified_scope: true,
      separated_must_have_from_optional: true,
      asked_clarifying_questions: true,
      used_given_facts: true,
      stated_assumptions: true,
      proposed_viable_alternative: true,
      gave_owner: true,
      gave_timeline: true,
      gave_risk_plan: true,
      handled_coworker_conflict: true,
      managed_client_expectation: true,
      final_plan_complete: true
    };
    const raw = await mockDeepSeekResponse(
      judgePrompt,
      `
Full chat:
用户：我会先控制现场影响并说明可见补救，再和小林明确责任、补救动作和复核标准，最后和江师傅确认前厅后厨衔接流程和后续复盘。

Final Blackboard:
${JSON.stringify(bb, null, 2)}

Group summary:
{}
`
    );
    const result = JSON.parse(raw);

    expect(result.total_score).toBeGreaterThanOrEqual(120);
    expect(result.total_score).toBeLessThanOrEqual(145);
    expect(result.radar_chart_data.map((item: { name: string }) => item.name)).toEqual(["利害识别", "现场止损", "规则边界", "承诺边界", "面子修复", "员工修复", "后厨协同", "系统改进"]);
  });

  it("mock leader varies pressure instead of repeating fixed scenario facts", async () => {
    const leaderPrompt = readPrompt("leader.prompt.txt");
    const raw = await mockDeepSeekResponse(
      leaderPrompt,
      `
Blackboard:
{
  "round": 2
}

Chat history:
陈总：你先说，哪几项数据是confirm过的。

User reply:
我还在想，先做一个大概方案。
`
    );
    const result = JSON.parse(raw);
    const content = result.visible_reply.content as string;

    expect(content).toMatch(/执行|判断|目标|风险|下一步|客户|同事|团队/);
    expect(content).not.toContain("设计稿三页缺失，苏姐组里有设计师但团队超负荷");
  });

  it("detects and replaces NPC replies that solve the task for the user", () => {
    expect(findNpcBoundaryViolation("client", "我建议你们设计用模板凑合一下，汇报话术我帮你写好。")).toBeTruthy();
    expect(findNpcBoundaryViolation("client", "下午4点前设计稿能出来吗？哪些数据confirm过？")).toBeNull();

    const fallback = createBoundarySafeNpcResult("client");
    expect(fallback.visible_reply.speaker).toBe("客户方");
    expect(fallback.visible_reply.content).toMatch(/判断|风险|依据/);
    expect(fallback.visible_reply.content).not.toMatch(/我建议你们|我帮你|完整方案/);
  });

  it("mock client answers factual clarification without proposing a solution", async () => {
    const clientPrompt = readPrompt("client.prompt.txt");
    const raw = await mockDeepSeekResponse(
      clientPrompt,
      `
Blackboard:
{}

Chat history:
用户：我想确认，苏姐组里现在是什么情况？

User reply:
我想确认，苏姐组里现在是什么情况？小葛这两天能抽出来吗？
`
    );
    const result = JSON.parse(raw);
    const content = result.visible_reply.content as string;

    expect(result.visible_reply.speaker).toBe("小秋");
    expect(content).toMatch(/参考|标准|VI|不确定/);
    expect(content).not.toMatch(/你应该|我建议你们|完整方案|我来安排/);
  });

  it("mock restaurant scenario uses customer and employee roles", async () => {
    const clientPrompt = readPrompt("client.prompt.txt");
    const coworkerPrompt = readPrompt("coworker.prompt.txt");
    const blackboard = JSON.stringify(createInitialBlackboard(10, "coffee_shop_complaint"), null, 2);

    const clientRaw = await mockDeepSeekResponse(
      clientPrompt,
      `
Blackboard:
${blackboard}

Chat history:
刘总：菜我已经不想说了。那个学徒在后巷站着，厨房那边也等着你说法。

User reply:
我先向您道歉。首先确认您是否接受重做或退款，其次安排后厨继续稳定出菜。
`
    );
    const clientResult = JSON.parse(clientRaw);

    const coworkerRaw = await mockDeepSeekResponse(
      coworkerPrompt,
      `
Blackboard:
${blackboard}

Chat history:
小林：我是不是要被骂了？

User reply:
小林你先别慌，我来对顾客说明，你先把后续菜品的装盘复核和异物检查做稳，这次责任我负责现场处理。
`
    );
    const coworkerResult = JSON.parse(coworkerRaw);

    expect(clientResult.visible_reply.speaker).toBe("江师傅");
    expect(coworkerResult.visible_reply.speaker).toBe("小林");
    expect(clientResult.visible_reply.content).toMatch(/标准|框架|方向|系统|流程/);
    expect(coworkerResult.visible_reply.content).toMatch(/配合|补救|顾客|复核|异物|责任/);
  });

  it("mock director reacts to unresolved fact-based goals without fixed round scheduling", async () => {
    const directorPrompt = readPrompt("director.prompt.txt");
    const baseInput = `
Blackboard:
{
  "round": 3,
  "user_progress": {
    "identified_core_flow": true,
    "clarified_scope": true,
    "separated_must_have_from_optional": true,
    "used_given_facts": true,
    "gave_timeline": true,
    "gave_risk_plan": true,
    "handled_coworker_conflict": false,
    "managed_client_expectation": true
  }
}

Chat history:
用户：下午4点前confirm过的三件事先上，assumption标注，苏姐那边谈借人条件。

User reply:
下午4点前confirm过的三件事先上，assumption标注，苏姐那边谈借人条件。
`;

    const coworkerRaw = await mockDeepSeekResponse(directorPrompt, baseInput);
    const coworkerResult = JSON.parse(coworkerRaw);

    const clientInput = `
Blackboard:
{
  "round": 3,
  "user_progress": {
    "identified_core_flow": true,
    "clarified_scope": true,
    "separated_must_have_from_optional": true,
    "used_given_facts": true,
    "gave_owner": true,
    "gave_timeline": true,
    "gave_risk_plan": true,
    "handled_coworker_conflict": true,
    "managed_client_expectation": false
  }
}

Chat history:
用户：我负责推进汇报材料，confirm项和assumption项分列。找苏姐谈借小葛条件，小秋给三个VI底线标准。

User reply:
我负责推进汇报材料，confirm项和assumption项分列。找苏姐谈借小葛条件，小秋给三个VI底线标准。
`;

    const clientRaw = await mockDeepSeekResponse(directorPrompt, clientInput);
    const clientResult = JSON.parse(clientRaw);

    expect(coworkerResult.active_agent).toBe("coworker");
    expect(["leader", "client"]).toContain(clientResult.active_agent);
    expect(clientResult.active_agent).not.toBe(coworkerResult.active_agent);
  });

  it("mock group discussion does not override a consistent Director proposal", async () => {
    const groupPrompt = readPrompt("group-discussion.prompt.txt");
    const raw = await mockDeepSeekResponse(
      groupPrompt,
      `
Round: 3

Director proposal:
{
  "active_agent": "coworker",
  "current_focus": "暴露用户如何处理苏姐资源负载、协作条件和责任边界",
  "npc_instruction": "追问用户如何说明协作负载、交换条件和责任边界",
  "phase": "coworker_boundary"
}

Blackboard:
{
  "round": 2,
  "user_progress": {
    "clarified_scope": true,
    "gave_risk_plan": true,
    "handled_coworker_conflict": false,
    "managed_client_expectation": false
  },
  "conversation_control": {
    "last_active_agent": "leader"
  }
}

Chat history:
用户：下午4点前confirm项先上，设计缺口找苏姐借人，小秋给标准出框架。
`
    );
    const result = JSON.parse(raw);

    expect(result.no_change).toBe(true);
    expect(result.correction).toBeNull();
  });

  it("mock group discussion corrects an obvious agent-focus mismatch", async () => {
    const groupPrompt = readPrompt("group-discussion.prompt.txt");
    const raw = await mockDeepSeekResponse(
      groupPrompt,
      `
Round: 3

Director proposal:
{
  "active_agent": "coworker",
  "current_focus": "验证用户能否给后厨系统问题承认",
  "npc_instruction": "追问江师傅需要什么流程改进",
  "phase": "client_expectation"
}

Blackboard:
{
  "round": 2,
  "user_progress": {
    "clarified_scope": true,
    "gave_risk_plan": true,
    "handled_coworker_conflict": true,
    "managed_client_expectation": false
  },
  "conversation_control": {
    "last_active_agent": "leader"
  }
}

Chat history:
用户：我会控制现场影响，再和小林明确责任、补救动作和复核标准。
`
    );
    const result = JSON.parse(raw);

    expect(result.no_change).toBe(false);
    expect(result.conflicts[0].type).toBe("agent_focus_mismatch");
    expect(result.correction.next_agent).toBe("client");
  });

  it("mock director avoids repeated leader turns unless escalation is required", async () => {
    const directorPrompt = readPrompt("director.prompt.txt");
    const repeatedLeaderInput = `
Blackboard:
{
  "round": 2,
  "conversation_control": {
    "last_active_agent": "leader"
  },
  "user_progress": {
    "identified_core_flow": true,
    "clarified_scope": false,
    "handled_coworker_conflict": false,
    "managed_client_expectation": false
  }
}

Chat history:
陈总：下午4点汇报，数据confirm了吗？

User reply:
我先确认三件事的数据来源，设计缺口有两个路径——苏姐借人或小秋出框架。
`;

    const rotatedRaw = await mockDeepSeekResponse(directorPrompt, repeatedLeaderInput);
    const rotated = JSON.parse(rotatedRaw);

    const escalationRaw = await mockDeepSeekResponse(
      directorPrompt,
      repeatedLeaderInput.replace("我先确认三件事的数据来源，设计缺口有两个路径——苏姐借人或小秋出框架。", "全部数据都confirm过没有问题，设计稿肯定能出来不用担心。")
    );
    const escalation = JSON.parse(escalationRaw);

    expect(rotated.active_agent).toBe("coworker");
    expect(escalation.active_agent).toBe("leader");
  });
});
