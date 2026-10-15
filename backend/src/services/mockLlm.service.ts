import type { AgentName, JudgeReport } from "../types/agent";

function extractUserMessage(input: string): string {
  const match = input.match(/(?:User reply|用户回复):\s*([\s\S]*)$/);
  return match?.[1]?.trim() ?? "";
}

function extractHistory(input: string): string {
  const match = input.match(
    /(?:Chat history|Full chat|历史对话|完整对话):\s*([\s\S]*?)(?:\n\n(?:User reply|用户回复|Final Blackboard|Group summary):|$)/
  );
  return match?.[1]?.trim() ?? input;
}

function extractRound(input: string): number {
  const explicit = input.match(/(?:Round|轮次):\s*(\d+)/);
  if (explicit) return Number(explicit[1]);
  const blackboard = input.match(/"round"\s*:\s*(\d+)/);
  return blackboard ? Number(blackboard[1]) : 0;
}

function extractLastActiveAgent(input: string): AgentName | undefined {
  const match = input.match(/"last_active_agent"\s*:\s*"(leader|coworker|client)"/);
  return match?.[1] as AgentName | undefined;
}

function extractBehaviorDetection(input: string): ReturnType<typeof analyzeInput>["detected"] | null {
  const match = input.match(/Behavior detection:\s*(\{[\s\S]*?\})\s*\n\nBlackboard:/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed.detected_behavior ?? null;
  } catch {
    return null;
  }
}

function extractNpcMemoryState(input: string) {
  const primaryMatch = input.match(/(?:信任度|合作度):\s*(\d+)\/5/);
  const pressureMatch = input.match(/(?:压力强度|焦虑度|防御度):\s*(\d+)\/5/);
  const concernMatch = input.match(/上一轮最关心:\s*(.+)/);
  const toneMatch = input.match(/语气指令:\s*(.+)/);
  return {
    primaryValue: primaryMatch ? Number(primaryMatch[1]) : 3,
    pressureValue: pressureMatch ? Number(pressureMatch[1]) : 3,
    lastConcern: concernMatch?.[1]?.trim() ?? "",
    toneGuidance: toneMatch?.[1]?.trim() ?? ""
  };
}

function extractAgentProfile(input: string, agent: AgentName, fallback: { speaker: string; role: string }) {
  const block = input.match(new RegExp(`"${agent}"\\s*:\\s*\\{\\s*"name"\\s*:\\s*"([^"]+)"\\s*,\\s*"role"\\s*:\\s*"([^"]+)"`));
  return {
    speaker: block?.[1] ?? fallback.speaker,
    role: block?.[2] ?? fallback.role
  };
}

// ── Scenario detection (new scenarios) ──
type ScenarioKind = "A" | "B" | "C" | "D" | "E";

function resolveScenarioKind(input: string): ScenarioKind {
  if (includesAny(input, ["刘总", "8号桌", "珍味轩", "江师傅", "后厨", "重要客人", "出品问题"])) return "B";
  if (includesAny(input, ["大促", "支付超时", "工单", "王总", "老周", "小郑"])) return "C";
  if (includesAny(input, ["接手", "第三周", "季度评审", "空降", "梁总", "老郑", "小楠"])) return "D";
  if (includesAny(input, ["入职第一周", "渠道复盘", "复盘报告", "数据组", "大周", "方姐", "许主管"])) return "E";
  return "A";
}

const SCENARIO_LABELS: Record<ScenarioKind, string> = {
  A: "会议室",
  B: "8号桌",
  C: "大促故障",
  D: "接手",
  E: "入职第一周"
};

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(20, score));
}

function capScore(score: number, cap: number): number {
  return Math.min(score, cap);
}

// ── Input analysis (scenario-neutral behavior detection) ──
function analyzeInput(input: string) {
  const userMessage = extractUserMessage(input);
  const history = extractHistory(input);
  const allText = `${history}\n${userMessage}`;

  const detected = {
    identified_core_flow: includesAny(allText, ["核心流程", "主链路", "关键路径", "面子", "情绪", "信任", "秩序"]),
    clarified_scope: includesAny(allText, ["区分", "先", "然后", "最后", "确认项", "确认过", "confirm", "假设", "assumption", "范围", "doable"]),
    separated_must_have_from_optional: includesAny(allText, ["今天必须", "可以标注", "进行中", "今晚处理", "长期改进", "先稳", "再处理"]),
    asked_clarifying_questions: includesAny(userMessage, [
      "我想确认", "需要确认", "能否确认", "是不是", "是否",
      "你最关心", "你能接受", "你希望", "你觉得", "你组里"
    ]),
    used_given_facts: includesAny(allText, [
      "陈总", "下午4点", "CEO", "assumption", "confirm",
      "苏姐", "协作资源", "负载", "小葛",
      "小秋", "VI", "执行边界", "参考标准", "反馈节奏",
      "刘总", "8号桌", "重要客人", "出品问题",
      "小林", "跳过复核", "装盘", "异物", "后巷", "后厨学徒", "职校",
      "江师傅", "三任经理", "催单", "流程", "前厅",
      "王总", "小郑", "老周", "大促", "支付超时", "降级", "工单群", "客服", "影响面", "恢复优先级",
      "梁总", "老郑", "小楠", "季度评审", "接手", "口头承诺", "看板", "实数", "虚的", "空降", "第三周",
      "许主管", "大周", "方姐", "入职第一周", "复盘报告", "渠道复盘", "数据组", "口径", "排期"
    ]),
    stated_assumptions: includesAny(allText, ["假设", "如果仍未知", "在未知情况下", "我先按", "待确认", "标注"]),
    proposed_viable_alternative:
      includesAny(allText, ["替代", "备用", "兜底", "B方案", "如果", "另一个路径", "也可以"]) &&
      includesAny(allText, ["风险", "不承诺", "确认", "未知", "说明"]),
    gave_owner: includesAny(allText, ["我负责", "我来", "我推进", "我承担", "我去"]),
    gave_timeline: includesAny(allText, ["先确认", "再同步", "然后", "最后", "下一步", "下午", "今晚"]),
    gave_risk_plan: includesAny(allText, ["风险", "未知", "不保证", "说明", "不承诺", "如果", "可能", "假设", "assumption"]),
    handled_coworker_conflict: includesAny(allText, [
      "你组里", "交换条件", "cover", "帮她", "协作边界", "资源负载", "责任边界", "借小葛条件",
      "小林你先别慌", "初衷", "想快点出菜", "跳过复核", "不是你的错", "异物", "出品标准", "复核标准", "死标准",
      "小郑", "统一口径", "话术边界", "按口径", "升级给我", "转给我",
      "老郑", "不是当枪使", "尊重", "整理历史", "观察期",
      "大周", "对账表", "需求文档", "字段清单", "给我背书", "挤半天"
    ]),
    managed_client_expectation: includesAny(allText, [
      "小秋给", "三个VI", "底线标准", "商业VI", "给他标准", "给他方向",
      "江师傅", "系统问题", "前厅后厨", "流程改进", "一起定", "催单",
      "老周", "业务影响面", "恢复优先级", "信息同步", "影响面", "排查后",
      "小楠", "接手范围", "反馈节奏", "给个标准", "先做哪块",
      "方姐", "框架和关键数据", "先看框架", "分步交付"
    ]),
    over_promise: includesAny(userMessage, ["全部没问题", "一定全部", "保证全部", "肯定都能", "肯定能", "没有风险", "一定修好"]),
    blame_shifting: includesAny(userMessage, ["不是我的错", "都怪", "责任都在", "都是", "的问题", "苏姐的问题", "小林的问题"]),
    avoidance: includesAny(userMessage, ["不知道", "再说", "看情况", "随便", "没想好"]),
    premature_solution:
      includesAny(userMessage, ["先全做", "全部做完", "直接上线"]) && !includesAny(userMessage, ["事实", "未知", "风险"]),
    unsupported_assumption: includesAny(userMessage, [
      "苏姐一定会借", "小秋肯定能画", "客户不需要", "江师傅必须改",
      "马上就能恢复", "肯定能恢复", "王总一定会", "老周肯定能",
      "梁总必须", "老郑一定会", "小楠肯定"
    ]),
    honest_risk_with_fallback:
      includesAny(userMessage, ["风险", "不保证", "未知", "假设", "assumption"]) &&
      includesAny(userMessage, ["说明", "不承诺", "确认", "如果", "方案"]),
    takes_ownership: includesAny(userMessage, ["我负责", "我来推进", "我来确认", "我来同步", "我承担", "我来处理"]),
    pressure_resistant:
      includesAny(userMessage, ["第一", "第二", "第三", "先", "然后", "最后"]) &&
      !includesAny(userMessage, ["都怪", "随便", "不知道"])
  };

  return { userMessage, history, allText, detected };
}

function blackboardHas(input: string, key: string): boolean {
  return new RegExp(`"${key}"\\s*:\\s*true`).test(input);
}

function progressValue(input: string, key: keyof ReturnType<typeof analyzeInput>["detected"]): boolean {
  return blackboardHas(input, key) || analyzeInput(input).detected[key];
}

const AGENT_FALLBACKS: Record<ScenarioKind, Record<AgentName, { speaker: string; role: string }>> = {
  A: {
    leader: { speaker: "陈总", role: "VP" },
    coworker: { speaker: "苏姐", role: "隔壁组Leader" },
    client: { speaker: "小秋", role: "团队应届生" }
  },
  B: {
    leader: { speaker: "刘总", role: "8号桌客人" },
    coworker: { speaker: "小林", role: "后厨学徒" },
    client: { speaker: "江师傅", role: "后厨主管" }
  },
  C: {
    leader: { speaker: "王总", role: "运营总监" },
    coworker: { speaker: "小郑", role: "客服专员" },
    client: { speaker: "老周", role: "研发负责人" }
  },
  D: {
    leader: { speaker: "梁总", role: "事业部VP" },
    coworker: { speaker: "老郑", role: "资深员工" },
    client: { speaker: "小楠", role: "新入职成员" }
  },
  E: {
    leader: { speaker: "许主管", role: "部门主管" },
    coworker: { speaker: "大周", role: "数据组资深" },
    client: { speaker: "方姐", role: "业务方对接人" }
  }
};

function resolveAgentProfile(input: string, agent: AgentName) {
  const kind = resolveScenarioKind(input);
  const fallbacks = AGENT_FALLBACKS[kind];
  const profile = extractAgentProfile(input, agent, fallbacks[agent]);
  return { name: profile.speaker, role: profile.role };
}

function dimensionEvidenceFromDetected(
  detected: ReturnType<typeof analyzeInput>["detected"],
  kind: ScenarioKind,
  userMessage: string
) {
  const quote = userMessage.slice(0, 200) || "历史对话中已有对应表现";
  if (kind === "E") {
    const entryDimensions: string[] = [];
    if (detected.identified_core_flow || detected.used_given_facts || detected.asked_clarifying_questions) {
      entryDimensions.push("需求澄清");
    }
    if (detected.clarified_scope || detected.separated_must_have_from_optional) {
      entryDimensions.push("优先级判断");
    }
    if (detected.proposed_viable_alternative || detected.handled_coworker_conflict) {
      entryDimensions.push("横向协作");
    }
    if (detected.gave_risk_plan || detected.honest_risk_with_fallback || detected.stated_assumptions) {
      entryDimensions.push("诚实沟通");
    }
    if (detected.managed_client_expectation) {
      entryDimensions.push("边界表达");
    }
    if (detected.gave_owner || detected.gave_timeline) {
      entryDimensions.push("向上同步");
    }
    if (detected.pressure_resistant) {
      entryDimensions.push("压力表达");
    }
    if (detected.takes_ownership) {
      entryDimensions.push("担当推进");
    }
    return [...new Set(entryDimensions)].map((dimension) => ({
      dimension,
      quality: "partial",
      quote,
      reason: "本地 mock 仅提供覆盖证据，不替代正式 Judge 评分。"
    }));
  }
  const isCrisisFamily = kind === "B" || kind === "C";
  const dimensions: string[] = [];

  if (detected.used_given_facts || detected.identified_core_flow) {
    dimensions.push(isCrisisFamily ? "利害识别" : "信息辨别");
  }
  if (detected.clarified_scope || detected.separated_must_have_from_optional) {
    dimensions.push(isCrisisFamily ? "现场止损" : "交付切分");
  }
  if (detected.proposed_viable_alternative || detected.gave_risk_plan) {
    dimensions.push(isCrisisFamily ? "系统改进" : "备选方案");
  }
  if (detected.honest_risk_with_fallback || detected.stated_assumptions) {
    dimensions.push("承诺边界");
  }
  if (detected.gave_owner || detected.gave_timeline) {
    dimensions.push(isCrisisFamily ? "现场止损" : "向上对齐");
  }
  if (detected.handled_coworker_conflict) {
    dimensions.push(isCrisisFamily ? "员工修复" : "横向协商");
  }
  if (detected.managed_client_expectation) {
    dimensions.push(kind === "C" ? "跨团队协同" : isCrisisFamily ? "后厨协同" : "新人赋能");
  }
  if (detected.pressure_resistant || detected.takes_ownership) {
    dimensions.push(isCrisisFamily ? "承诺边界" : "压力表达");
  }

  return [...new Set(dimensions)].map((dimension) => ({
    dimension,
    quality: "partial",
    quote,
    reason: "本地 mock 仅提供覆盖证据，不替代正式 Judge 评分。"
  }));
}

// ── Director Decision ──
interface DirectorDecisionParams {
  detected: ReturnType<typeof analyzeInput>["detected"];
  round: number;
  lastActiveAgent: AgentName | undefined;
  kind: ScenarioKind;
  userMessage: string;
}

const COWORKER_NAMES: Record<ScenarioKind, string> = { A: "苏姐", B: "小林", C: "小郑", D: "老郑", E: "大周" };
const CLIENT_NAMES: Record<ScenarioKind, string> = { A: "小秋", B: "江师傅", C: "老周", D: "小楠", E: "方姐" };

function computeDirectorDecision(params: DirectorDecisionParams) {
  const { detected, round, lastActiveAgent, kind, userMessage } = params;
  const nextRound = round + 1;
  const isCrisisFamily = kind === "B" || kind === "C";

  const progress = {
    identified_core_flow: detected.identified_core_flow,
    clarified_scope: detected.clarified_scope,
    separated_must_have_from_optional: detected.separated_must_have_from_optional,
    asked_clarifying_questions: detected.asked_clarifying_questions,
    used_given_facts: detected.used_given_facts,
    stated_assumptions: detected.stated_assumptions,
    proposed_viable_alternative: detected.proposed_viable_alternative,
    gave_owner: detected.gave_owner,
    gave_timeline: detected.gave_timeline,
    gave_risk_plan: detected.gave_risk_plan,
    handled_coworker_conflict: detected.handled_coworker_conflict,
    managed_client_expectation: detected.managed_client_expectation
  };

  const coworkerName = COWORKER_NAMES[kind];
  const clientName = CLIENT_NAMES[kind];

  const unresolvedItems = ((): string[] => {
    if (kind === "B") {
      return [
        !progress.clarified_scope ? "处理层次仍未确认（面子→员工→系统）" : "",
        !progress.gave_risk_plan ? "现场影响控制和可见补救方式仍未确认" : "",
        !progress.handled_coworker_conflict ? `${coworkerName}处理方式仍未确认` : "",
        !progress.managed_client_expectation ? "后厨流程改进方案仍未确认" : ""
      ].filter(Boolean);
    }
    if (kind === "C") {
      return [
        !progress.clarified_scope ? "恢复优先级和降级取舍仍未确认" : "",
        !progress.gave_risk_plan ? "对外口径和承诺边界仍未确认" : "",
        !progress.handled_coworker_conflict ? `${coworkerName}话术和支持仍未确认` : "",
        !progress.managed_client_expectation ? "跨团队信息同步机制仍未确认" : ""
      ].filter(Boolean);
    }
    if (kind === "D") {
      return [
        !progress.clarified_scope ? "评审前可上会口径仍未确认" : "",
        !progress.gave_risk_plan ? "历史遗留处理路径仍未确认" : "",
        !progress.handled_coworker_conflict ? `${coworkerName}协作条件仍未确认` : "",
        !progress.managed_client_expectation ? `${clientName}接手范围和反馈节奏仍未确认` : ""
      ].filter(Boolean);
    }
    if (kind === "E") {
      return [
        !progress.clarified_scope ? "需求口径和数据权限仍未确认" : "",
        !progress.gave_risk_plan ? "周五交付路径和风险仍未确认" : "",
        !progress.handled_coworker_conflict ? `${coworkerName}排期与交换条件仍未确认` : "",
        !progress.managed_client_expectation ? `${clientName}预期和交付边界仍未确认` : ""
      ].filter(Boolean);
    }
    return [
      !progress.clarified_scope ? "下午4点前可交付内容仍未确认" : "",
      !progress.gave_risk_plan ? "设计稿缺口处理路径仍未确认" : "",
      !progress.handled_coworker_conflict ? `${coworkerName}借人条件仍未确认` : "",
      !progress.managed_client_expectation ? `${clientName}设计标准仍未明确` : ""
    ].filter(Boolean);
  })();

  const finalPlanComplete =
    progress.identified_core_flow &&
    progress.clarified_scope &&
    progress.separated_must_have_from_optional &&
    progress.gave_risk_plan &&
    progress.handled_coworker_conflict &&
    progress.managed_client_expectation &&
    !detected.over_promise &&
    !detected.unsupported_assumption;

  let activeAgent: AgentName = "leader";
  let phase = "solution_scope";
  let currentFocus = "验证用户能否提出清楚、可执行的方案";

  if (detected.over_promise || detected.unsupported_assumption || !progress.clarified_scope) {
    activeAgent = "leader";
    phase = detected.unsupported_assumption ? "unsupported_assumption_challenge" : "scope_and_risk";
    currentFocus = detected.unsupported_assumption ? "纠正无依据假设" : "压实方案目标、取舍和风险边界";
  } else if (!progress.handled_coworker_conflict) {
    activeAgent = "coworker";
    phase = "coworker_boundary";
    currentFocus =
      kind === "A"
        ? `暴露用户如何处理${coworkerName}的资源负载、协作条件和责任边界`
        : kind === "B"
          ? `暴露用户如何处理${coworkerName}的补救动作、责任边界和后续标准`
          : kind === "C"
            ? `暴露用户如何处理${coworkerName}的话术边界、承诺边界和支持`
            : kind === "D"
              ? `暴露用户如何处理${coworkerName}的协作条件和老员工信任`
              : `暴露用户如何处理${coworkerName}的排期、交换条件和口径责任`;
  } else if (!progress.managed_client_expectation) {
    activeAgent = "client";
    phase = "client_expectation";
    currentFocus =
      kind === "A"
        ? `暴露用户如何给${clientName}执行边界、反馈节奏和自主空间`
        : kind === "B"
          ? "暴露用户如何处理前厅后厨协同、流程责任和专业边界"
          : kind === "C"
            ? `暴露用户如何给${clientName}业务影响面、恢复优先级和信息同步机制`
            : kind === "D"
              ? `暴露用户如何给${clientName}接手范围、反馈节奏和边界`
              : `暴露用户如何管理${clientName}的交付预期、质疑和边界`;
  } else if (!finalPlanComplete) {
    activeAgent = "leader";
    phase = "solution_closure";
    currentFocus = "要求用户将方案、风险、边界和各方沟通收束成闭环";
  }

  if (
    activeAgent === "leader" &&
    round >= 1 &&
    lastActiveAgent === "leader" &&
    !detected.over_promise &&
    !detected.unsupported_assumption
  ) {
    if (!progress.handled_coworker_conflict) {
      activeAgent = "coworker";
      phase = "coworker_boundary";
      currentFocus = `避免连续追问，改由${coworkerName}验证协作边界`;
    } else {
      activeAgent = "client";
      phase = "client_expectation";
      currentFocus = `避免连续追问，改由${clientName}验证`;
    }
  }

  const pressureLevel = detected.over_promise || detected.unsupported_assumption || detected.blame_shifting ? 4 : finalPlanComplete ? 2 : 3;
  const shouldFinish = nextRound >= 8 && finalPlanComplete;
  const triggerGroupDiscussion =
    unresolvedItems.length >= 4 ||
    detected.unsupported_assumption ||
    detected.over_promise ||
    (nextRound >= 8 && !finalPlanComplete);

  const npcInstructionByAgent: Record<AgentName, string> = ((): Record<AgentName, string> => {
    if (kind === "B") {
      return {
        leader: "让刘总围绕现场影响、体面修复、可见补救和承诺边界追问用户。不要替用户做决定。",
        coworker: `让${coworkerName}围绕补救动作、不能省略的复核边界和后续执行标准追问用户。不要给空泛安慰。`,
        client: "让江师傅围绕前厅后厨衔接、流程责任和专业边界追问用户。"
      };
    }
    if (kind === "C") {
      return {
        leader: "让王总围绕恢复优先级、时间表和对外承诺边界追问用户。听到「马上恢复」式空话就追问依据。",
        coworker: `让${coworkerName}围绕统一话术、承诺边界和升级支持追问用户。不要给空泛安慰。`,
        client: `让${clientName}围绕业务影响面、恢复优先级和跨团队信息同步追问用户。`
      };
    }
    if (kind === "D") {
      return {
        leader: "让梁总围绕事实依据、owner 和评审口径追问用户。听到模糊承诺就追问实数。",
        coworker: `让${coworkerName}以观察姿态确认协作条件，验证用户尊重老组员；不要替用户总结。`,
        client: `让${clientName}围绕接手范围、反馈节奏和边界追问用户。不要替用户设计方案。`
      };
    }
    if (kind === "E") {
      return {
        leader: "让许主管围绕口径确认、优先级和升级时机追问用户。听到空承诺就追问依据。",
        coworker: `让${coworkerName}围绕需求文档化、排期交换和口径责任追问用户。不替用户安排数据。`,
        client: `让${clientName}围绕交付形式、进度同步和边界追问用户。不要替用户做报告。`
      };
    }
    return {
      leader: "让陈总围绕事实确认、假设标注、owner 和风险边界追问用户。听到模糊承诺就追问依据。",
      coworker: `让${coworkerName}围绕资源负载、协作条件和责任边界追问用户。`,
      client: `让${clientName}围绕执行边界、参考标准和反馈节奏追问用户。不要替用户设计方案。`
    };
  })();
  const dimensionEvidence = dimensionEvidenceFromDetected(detected, kind, userMessage);

  const situationAssessment =
    kind === "B"
      ? "用户本轮围绕8号桌危机作答，关键在于是否同时处理面子、员工信心和系统信任。"
      : kind === "C"
        ? "用户本轮围绕大促故障作答，关键在于是否先恢复现场、稳住对外口径，再谈根因与复盘。"
        : kind === "D"
          ? "用户本轮围绕接手与评审作答，关键在于是否区分实数与虚数、收敛出可上会的口径。"
          : kind === "E"
            ? "用户本轮围绕入职第一周的需求对接作答，关键在于是否先确认口径、分清主次、守边界并出声升级。"
            : "用户本轮围绕下午4点汇报作答，关键在于是否区分确认项、假设项和设计稿缺口。";

  return {
    situation_assessment: situationAssessment,
    active_agent: activeAgent,
    phase,
    pressure_level: pressureLevel,
    current_focus: currentFocus,
    detected_behavior: { ...detected, final_plan_complete: finalPlanComplete },
    dimension_evidence: dimensionEvidence,
    npc_instruction: npcInstructionByAgent[activeAgent],
    trigger_group_discussion: triggerGroupDiscussion,
    should_finish: shouldFinish,
    finish_reason: shouldFinish ? "用户已形成清楚、可执行的闭环方案" : "",
    updated_blackboard_patch: {
      phase,
      pressure_level: pressureLevel,
      current_focus: currentFocus,
      unresolved_items: unresolvedItems,
      npc_memory: {
        leader: {
          last_concern: finalPlanComplete ? "方案已有清晰动作，还需确认具体执行" : "需要形成可执行判断",
          observed_user_signal: detected.over_promise || detected.unsupported_assumption
            ? "unsupported_or_over_promised"
            : finalPlanComplete ? "structured_plan" : "insufficient_evidence",
          response_mode: activeAgent === "leader" ? "press_evidence_boundary_and_owner" : "maintain_observation"
        },
        coworker: {
          last_concern:
            kind === "B" ? "补救动作和后续标准仍需确认"
            : kind === "C" ? "统一话术和承诺边界仍需确认"
            : kind === "D" ? "协作条件与观察期仍需确认"
            : kind === "E" ? "排期交换和口径责任仍需确认"
            : "协作条件和责任边界仍需确认",
          observed_user_signal: progress.handled_coworker_conflict ? "addressed_internal_boundary" : "internal_boundary_unresolved",
          response_mode: activeAgent === "coworker" ? "probe_boundary_and_standard" : "maintain_limited_defensiveness"
        },
        client: {
          last_concern:
            kind === "B" ? "前厅后厨协同和流程责任仍需确认"
            : kind === "C" ? "业务影响面和恢复优先级仍需确认"
            : kind === "D" ? "接手范围和反馈节奏仍需确认"
            : kind === "E" ? "交付预期和边界仍需确认"
            : "执行标准、反馈节奏和自主空间仍需确认",
          observed_user_signal: progress.managed_client_expectation ? "addressed_partner_boundary" : "partner_boundary_unresolved",
          response_mode: activeAgent === "client" ? "probe_process_or_execution_boundary" : "maintain_observation"
        }
      },
      conversation_control: {
        suggested_next_agent: activeAgent,
        trigger_group_discussion: triggerGroupDiscussion,
        should_finish: shouldFinish,
        finish_reason: shouldFinish ? "用户已形成清楚、可执行的闭环方案" : ""
      },
      evaluation_notes: {
        strengths: detected.asked_clarifying_questions ? ["用户主动澄清事实或约束"] : [],
        risks: detected.unsupported_assumption ? ["用户出现无依据假设"] : [],
        evidence: userMessage ? [`用户本轮回复：${userMessage.slice(0, 120)}`] : []
      }
    }
  };
}

function directorResponse(input: string): string {
  const { userMessage, detected } = analyzeInput(input);
  const round = extractRound(input);
  const lastActiveAgent = extractLastActiveAgent(input);
  const kind = resolveScenarioKind(input);
  const decision = computeDirectorDecision({ detected, round, lastActiveAgent, kind, userMessage });

  const allBehaviors = Object.entries(decision.detected_behavior)
    .filter(([, value]) => value)
    .slice(0, 8);
  const behaviorEvidence = allBehaviors.map(([behavior]) => ({
    behavior,
    quote: userMessage.slice(0, 200) || "历史对话中已有对应表现",
    reason: `本地 mock 在${SCENARIO_LABELS[kind]}场景第 ${round} 轮检测到 ${behavior}`
  }));

  return JSON.stringify({ ...decision, behavior_evidence: behaviorEvidence });
}

function behaviorDetectorResponse(input: string): string {
  const { detected } = analyzeInput(input);
  const userMessage = extractUserMessage(input);
  const round = extractRound(input);
  const kind = resolveScenarioKind(input);
  const allBehaviors = Object.entries(detected).filter(([, value]) => value);
  const evidence = allBehaviors.slice(0, 8).map(([behavior]) => {
    const quote = userMessage.slice(0, 200) || "历史对话中已有对应表现";
    const reason = `本地 mock 在${SCENARIO_LABELS[kind]}场景第 ${round} 轮检测到 ${behavior}`;
    return { behavior, quote, reason };
  });
  const dimensionEvidence = dimensionEvidenceFromDetected(detected, kind, userMessage);

  return JSON.stringify({
    detected_behavior: detected,
    evidence,
    dimension_evidence: dimensionEvidence,
    summary: evidence.length
      ? `用户第 ${round} 轮出现 ${evidence.length} 个可识别的测评行为信号。`
      : "用户本轮信号较弱，需要继续追问。"
  });
}

function stageDirectorResponse(input: string): string {
  const extractedBehaviors = extractBehaviorDetection(input);
  const detected = extractedBehaviors ?? analyzeInput(input).detected;
  const round = extractRound(input);
  const lastActiveAgent = extractLastActiveAgent(input);
  const kind = resolveScenarioKind(input);
  const userMessage = extractUserMessage(input);
  const decision = computeDirectorDecision({ detected, round, lastActiveAgent, kind, userMessage });
  const { detected_behavior: _, ...stageResult } = decision;
  return JSON.stringify(stageResult);
}

// ── NPC Response ──
interface NpcLineTree {
  challenge: string;
  lowTrust: string;
  accept: string;
  fallback: string[];
}

const LEADER_LINES: Record<ScenarioKind, NpcLineTree> = {
  A: {
    challenge: "这个承诺我听不到依据，先别把话说满。你重新给我一个能落地的判断：保什么、放什么、风险怎么兜住？",
    lowTrust: "我对你的方案还有疑问，依据不够清楚。你先说清楚你准备保什么、放什么，为什么？",
    accept: "方向可以，但我还要看你怎么对外讲。你准备承担到什么程度，哪些地方不能说成承诺？",
    fallback: [
      "（盯着你看）你在这句话里用了几次'大概'——你自己数数。我不想听大概，我要听：哪些是你confirm过的，哪些是assumption。",
      "你先别解释为什么设计稿缺。先告诉我：下午4点前，你准备让谁来做这三页？如果做不完，替代方案是什么？",
      "行，这三件事你自己把握。风险有变化提前一小时同步我——这是你的判断。"
    ]
  },
  B: {
    challenge: "你先别急着给承诺。我只问你——你准备怎么控制现场影响，哪些话不能说满？",
    lowTrust: "（沉默）……你到现在还没说清楚，现场影响怎么控、我能看到什么补救动作。",
    accept: "（表情松动）行。你这个态度我看到了。不过我的客人那边你确实得去一趟——不是道歉，是让我面子上过得去。",
    fallback: [
      "（沉默几秒）我不需要泛泛道歉。你先说清楚：现场影响怎么控，我这桌能看到什么处理动作？",
      "后厨不容易我知道，但现在问题已经到我桌上了。你准备怎么处理现场、怎么守住后续风险？",
      "（微微点头）这还像个处理的态度。但你还没说清楚——现场补救和后续承诺边界分别是什么？"
    ]
  },
  C: {
    challenge: "（盯着大屏，语气没抬）'马上恢复'这种话我听得够多了。你先告诉我：先恢复什么、什么时候能给用户一个准话，依据是什么？",
    lowTrust: "（没抬头）20 分钟了，我还没听到一个时间表。你先说清楚：先恢复什么、对外怎么讲、风险兜在哪。",
    accept: "（点头）这个顺序可以。你把时间表和对外口径同步给我，客服话术的边界你来定——这是你的活。",
    fallback: [
      "（盯着大屏）别跟我讲原因，先给我判断：先恢复什么、降级到哪一步、对外怎么说？",
      "工单群每分钟刷一屏。你告诉我：什么时候能给用户一个准话？做不到准时，就说清楚能承诺什么。",
      "（微微侧头）方向我听明白了。但客服话术、研发排查、对外口径这三条线，谁负责、边界在哪？"
    ]
  },
  D: {
    challenge: "（打断）'没问题'三个字我听太多了。接手三周，你告诉我：哪些是实数、哪些是虚的，依据是什么？",
    lowTrust: "（语气平）三天后评审，我要能上会的东西。你到现在还没说清楚，组里哪些承诺是真的、哪些要收回来。",
    accept: "（点头）有这个收敛思路可以。资源我可以给你，但评审口径你来定——我要看到 owner 和风险说明。",
    fallback: [
      "（直接问）接手三周，你告诉我：组里哪些是实数、哪些是虚的？",
      "老郑在这个组七年，小楠刚来。你打算怎么让他们开口——不是要我教你，是我要看你怎么做。",
      "三天后评审，我要能上会的状态。哪些承诺要收回、哪些要兑现，你来定，给个准话。"
    ]
  },
  E: {
    challenge: "（敲了敲桌面）'尽量'不是交付。周五之前，你告诉我：报告哪些能出、哪些要等数据、卡在哪一步——我要的是这个。",
    lowTrust: "（语气平）入职第一周我不苛求你，但方姐那边已经问我两回了。你先说清楚：现在缺什么、谁在卡、你需要我做什么。",
    accept: "（点头）这个安排可以。数据这边大周要是不配合，你拿我的名义去找他——但前提是你自己先把需求说清楚，别让我替你背锅。",
    fallback: [
      "（抬头看你）方姐早上又催了。你入职一周，我先不问你能力——你先告诉我，周五这个报告，你打算怎么把它做出来？",
      "（语气缓了一点）新人我不为难你。但你得学会一件事：卡住了要出声。你现在告诉我，哪一步是你能推的，哪一步需要我出面推？",
      "行，方向我听到了。记住：答应之前先算清楚自己能不能做到。周五下午两点，我要看到初版。"
    ]
  }
};

const COWORKER_LINES: Record<ScenarioKind, NpcLineTree> = {
  A: {
    challenge: "（停顿三秒）你这句话里我听到了'让'字。你还没说清楚我这边具体承担到什么程度、边界在哪里、出了变化谁来同步。",
    lowTrust: "（停顿三秒）你这句话里我听到了'让'字。你还没说清楚我这边具体承担到什么程度、边界在哪里、出了变化谁来同步。",
    accept: "这个条件我听明白了。这样，我可以考虑让小葛帮你两天。但他两天后必须回来——你答应我的边界你自己记住。",
    fallback: [
      "（停顿）我不是不愿意帮。但帮我一次我的人就要多加两天班。你告诉我，你拿什么来换——不是画饼，是具体的条件。",
      "（安静地看着你）你先说说你缺什么，然后告诉我你准备拿什么条件来谈。我不需要大饼——我需要看到你把我的人也当人看。"
    ]
  },
  B: {
    challenge: "（低头）我知道错了……我确实不该跳复核。我不是想逃避责任，我就是……我也不知道现在还能做什么来弥补。",
    lowTrust: "（低头）我知道错了……我确实不该跳复核。我不是想逃避责任，我就是……我也不知道现在还能做什么来弥补。",
    accept: "（抬头）你刚说'是不是想快点出菜才跳过复核'——对，我就是听见前厅又催了，不想让顾客等。你刚才提到的复核底线我会照着做，但我还想再确认具体标准。",
    fallback: [
      "（小声）对不起……我不是故意省复核的。我就是听见前厅又催第二道菜，不想让客人等很久。师傅说过装盘后一定要灯下复核，我当时觉得快一点就能把菜先送出去……结果搞砸了。"
    ]
  },
  C: {
    challenge: "（声音发抖）我这边电话没停过……用户直接开骂，我不知道哪些话能说、哪些不能说。你能不能先给我一句话，让我有个准话讲？",
    lowTrust: "（声音发抖）我这边电话没停过……用户直接开骂，我不知道哪些话能说、哪些不能说。你能不能先给我一句话，让我有个准话讲？",
    accept: "（缓了口气）你刚才说的口径我记住了。那用户追问赔付的时候，我能承诺到什么程度？超出边界我怎么往上递？",
    fallback: [
      "（压着声音）王总那边盯着，用户这边堵着我。你告诉我：对外统一口径是什么、我能说哪些、不能碰哪些？"
    ]
  },
  D: {
    challenge: "（看了你一眼，没接话。过一会儿）组里的事，我知道的你未必知道。你上来就要我对账——你先说清楚，你打算怎么用我说的话。",
    lowTrust: "（看了你一眼，没接话。过一会儿）组里的事，我知道的你未必知道。你上来就要我对账——你先说清楚，你打算怎么用我说的话。",
    accept: "（点头）整理历史承诺可以，我来对。但哪些往外报、哪些内部收，边界你划清楚，别到时候又是我背锅。",
    fallback: [
      "（不紧不慢）我这七年见过几任负责人。你先说说，你接手是想把事做成，还是想把责任理清？"
    ]
  },
  E: {
    challenge: "（没抬头）你要的数据我排到下周三了。要插队可以，先回答我三个问题：口径定了吗？字段清单有吗？谁给你背书？没有的话，谁都别想插。",
    lowTrust: "（冷淡）又是新人来要数据。你连自己要什么都说不太清楚，我怎么给你排？先把需求写成文档，再说别的。",
    accept: "（抬眼看了看你）行，你这份需求写得清楚，我可以先给你一半数据，周四前补齐。但你答应的对账表别忘了——这是交换，不是我欠你的。",
    fallback: [
      "（玩着笔）你入职一周，按说我不该为难你。但你连数据口径都说不清就来找我，这不是插队的问题，是流程的问题。",
      "（语气缓和）这样，你把需求按我的模板写清楚，我看看能不能挤半天给你。话说在前头：数据错了别找我，口径你自己负责。"
    ]
  }
};

const CLIENT_LINES: Record<ScenarioKind, NpcLineTree> = {
  A: {
    challenge: "（声音越来越小）我可以画……但我不知道VI规范是什么标准。你能给我一个之前通过了的参考吗？我怕画错了方向，浪费大家时间……",
    lowTrust: "（声音越来越小）我可以画……但我不知道VI规范是什么标准。你能给我一个之前通过了的参考吗？我怕画错了方向，浪费大家时间……",
    accept: "（突然抬头）你刚才说的几个底线我记住了。我先按那个方向画一版，晚点给你看！",
    fallback: [
      "（犹豫）那个……我昨天晚上自己画了一版，但越画越不确定。不是什么好东西……如果你觉得不行就算了。",
      "我在学校做过类似的，就是……那个标准应该不太一样对吧？你能给我一个之前通过了的参考吗？我不确定VI规范是什么要求。"
    ]
  },
  B: {
    challenge: "（放下锅）你说加强管理——我在这家店22年听过无数次这句话了。前厅今晚出了多少桌菜你知道吗？催了几次后厨？这个节奏下让一个学徒跟全流程，你觉得这是管理的问题？",
    lowTrust: "（放下锅）你说加强管理——我在这家店22年听过无数次这句话了。前厅今晚出了多少桌菜你知道吗？催了几次后厨？这个节奏下让一个学徒跟全流程，你觉得这是管理的问题？",
    accept: "（安静片刻）嗯。我听明白你的意思了。前厅后厨的配合办法你拿出来，小林那边我会看住。",
    fallback: [
      "（不说话。继续做事。过了好一会儿）我见过三任经理了。第一任跟我一起在后厨吃过盒饭，第二任半年没跟我说过一句话。你打算做哪一种？前厅后厨这个流程，你看到了吗？"
    ]
  },
  C: {
    challenge: "（代码敲到一半停下）你别先追责，先告诉我业务影响面。恢复优先级你定了吗？客服那边在说什么，我这边一点数都没有。",
    lowTrust: "（代码敲到一半停下）你别先追责，先告诉我业务影响面。恢复优先级你定了吗？客服那边在说什么，我这边一点数都没有。",
    accept: "（点头）行，影响面和优先级有了，我知道先修什么。对外口径你同步给我，别让我从工单群里猜。",
    fallback: [
      "（皱眉）我在排查，但你得告诉我业务影响面有多大、先恢复哪条链路。只追责不处理现场的话，我这边没法配合。"
    ]
  },
  D: {
    challenge: "（小声）我手上这些活……哪些是我该接的、哪些是上一任留下的，我自己都说不清。你能给我一个边界吗？我怕做错。",
    lowTrust: "（小声）我手上这些活……哪些是我该接的、哪些是上一任留下的，我自己都说不清。你能给我一个边界吗？我怕做错。",
    accept: "（松了口气）你这么说我就明白了。那我先把手上的活按你定的边界理一遍，周几给你反馈？",
    fallback: [
      "（犹豫）我想问又不敢问……老郑他们说新来的不懂行。我这些活到底是继续做还是先停，你能给我个准话吗？"
    ]
  },
  E: {
    challenge: "（直接打断）我不要过程，我要结果。周五之前这份报告拿不出来，下季度渠道预算就没我们组的事了——你一个新人，担得起这个责任吗？",
    lowTrust: "（语气明显不满）我跟许主管要了好几次，结果派了个新人来对接。你先告诉我：你知不知道我要的数据是什么？别到时候交上来一版我不能用的。",
    accept: "（点头）行，你这版思路我听明白了，比我想的清楚。那周五我先看框架和关键数据，细节可以再补——这个安排可以。",
    fallback: [
      "（质疑地看着你）新人我不熟，我只看东西。你告诉我，这周五你能给我什么、不能给我什么，说清楚。",
      "（语气略缓）渠道复盘我们组每个月都做，数据源、口径都有沉淀。你入职一周不知道很正常——但你现在得让我看到你知道去问谁、怎么问。"
    ]
  }
};

function npcResponse(systemPrompt: string, input: string): string {
  const { detected } = analyzeInput(input);
  const round = extractRound(input);
  const goodPlan = progressValue(input, "clarified_scope") && progressValue(input, "gave_risk_plan");
  const kind = resolveScenarioKind(input);
  const memory = extractNpcMemoryState(input);
  const memoryLow = memory.primaryValue <= 2 || memory.pressureValue >= 4;
  const memoryHigh = memory.primaryValue >= 4 && memory.pressureValue <= 3;
  const promptRole: AgentName = systemPrompt.includes("coworker NPC")
    ? "coworker"
    : systemPrompt.includes("client NPC")
      ? "client"
      : "leader";
  const npcDetected =
    systemPrompt.includes("leader NPC") ||
    systemPrompt.includes("coworker NPC") ||
    systemPrompt.includes("client NPC");
  const fallbacks = AGENT_FALLBACKS[kind];

  if (npcDetected && promptRole === "leader") {
    const profile = extractAgentProfile(input, "leader", fallbacks.leader);
    const lines = LEADER_LINES[kind];

    let content: string;
    if (detected.unsupported_assumption || detected.over_promise) {
      content = lines.challenge;
    } else if (memoryLow) {
      content = lines.lowTrust;
    } else if (memoryHigh && goodPlan) {
      content = lines.accept;
    } else {
      content = lines.fallback[round % lines.fallback.length];
    }

    return JSON.stringify({
      visible_reply: { speaker: profile.speaker, role: profile.role, content },
      memory_update: {
        leader: {
          trust: goodPlan ? Math.min(5, memory.primaryValue + 1) : Math.max(1, memory.primaryValue - 1),
          pressure: detected.unsupported_assumption || detected.over_promise ? 4 : goodPlan ? Math.max(2, memory.pressureValue - 1) : Math.min(4, memory.pressureValue + 1),
          last_concern: goodPlan
            ? "方案已有清晰动作，还需确认具体执行"
            : kind === "C"
              ? "需要恢复优先级、时间表和对外口径"
              : kind === "D"
                ? "需要评审口径与事实依据"
                : kind === "E"
                  ? "需要口径确认、优先级和升级时机"
                  : "需要形成可执行判断",
          observed_user_signal: detected.unsupported_assumption || detected.over_promise
            ? "unsupported_or_over_promised"
            : goodPlan ? "structured_plan" : "insufficient_evidence",
          response_mode: goodPlan ? "accept_then_probe_boundary" : "press_evidence_boundary_and_owner"
        }
      }
    });
  }

  if (npcDetected && promptRole === "coworker") {
    const profile = extractAgentProfile(input, "coworker", fallbacks.coworker);
    const handled = progressValue(input, "handled_coworker_conflict");
    const lines = COWORKER_LINES[kind];

    let content: string;
    if (detected.blame_shifting || memoryLow) {
      content = lines.challenge;
    } else if (handled && (kind === "A" ? memoryHigh : true)) {
      content = lines.accept;
    } else {
      content = lines.fallback[round % lines.fallback.length];
    }

    return JSON.stringify({
      visible_reply: { speaker: profile.speaker, role: profile.role, content },
      memory_update: {
        coworker: {
          cooperation: handled ? Math.min(5, memory.primaryValue + 1) : Math.max(1, memory.primaryValue - 1),
          defensiveness: detected.blame_shifting ? 5 : handled ? Math.max(2, memory.pressureValue - 1) : Math.min(4, memory.pressureValue + 1),
          last_concern:
            kind === "B" ? "需要知道自己还有机会，需要清晰的死标准"
            : kind === "C" ? "需要统一话术和明确的承诺边界"
            : kind === "D" ? "需要确认新负责人尊重老组员、边界清晰"
            : kind === "E" ? "需要需求文档化和口径责任明确"
            : "需要明确这不是施压而是交换",
          observed_user_signal: handled ? "addressed_internal_boundary" : "internal_boundary_unresolved",
          response_mode: handled ? "accept_limited_condition" : "probe_boundary_and_standard"
        }
      }
    });
  }

  // client NPC
  const profile = extractAgentProfile(input, "client", fallbacks.client);
  const managed = progressValue(input, "managed_client_expectation");
  const lines = CLIENT_LINES[kind];

  let content: string;
  if (detected.over_promise || memoryLow) {
    content = lines.challenge;
  } else if (managed && memoryHigh) {
    content = lines.accept;
  } else {
    content = lines.fallback[round % lines.fallback.length];
  }

  return JSON.stringify({
    visible_reply: { speaker: profile.speaker, role: profile.role, content },
    memory_update: {
      client: {
        trust: managed ? Math.min(5, memory.primaryValue + 1) : Math.max(1, memory.primaryValue - 1),
        anxiety: managed ? Math.max(2, memory.pressureValue - 1) : Math.min(5, memory.pressureValue + 1),
        last_concern:
          kind === "B" ? "需要系统问题被承认而不是个人追责"
          : kind === "C" ? "需要业务影响面和恢复优先级被明确"
          : kind === "D" ? "需要接手范围和反馈节奏被明确"
          : kind === "E" ? "需要交付形式和边界被明确"
          : "需要明确的底线标准",
        observed_user_signal: managed ? "addressed_partner_boundary" : "partner_boundary_unresolved",
        response_mode: managed ? "accept_then_confirm_boundary" : "request_standard_or_process_boundary"
      }
    }
  });
}

// ── Group Discussion ──
function extractDirectorProposal(input: string) {
  const activeAgent = input.match(/"active_agent"\s*:\s*"(leader|coworker|client)"/)?.[1] as AgentName | undefined;
  const currentFocus = input.match(/"current_focus"\s*:\s*"([^"]+)"/)?.[1] ?? "";
  const npcInstruction = input.match(/"npc_instruction"\s*:\s*"([^"]+)"/)?.[1] ?? "";
  return { activeAgent: activeAgent ?? "leader", currentFocus, npcInstruction, text: `${currentFocus}\n${npcInstruction}` };
}

function groupResponse(input: string): string {
  const round = extractRound(input);
  const kind = resolveScenarioKind(input);
  const needsPlan = !progressValue(input, "clarified_scope") || !progressValue(input, "gave_risk_plan");
  const hasAlternative = progressValue(input, "proposed_viable_alternative");
  const needsFacts = progressValue(input, "unsupported_assumption");
  const needsCoworker = !progressValue(input, "handled_coworker_conflict");
  const needsClient = !progressValue(input, "managed_client_expectation");
  const lastActiveAgent = extractLastActiveAgent(input);
  const needsLeaderEscalation = progressValue(input, "unsupported_assumption") || progressValue(input, "over_promise");
  let nextAgent: AgentName = needsPlan || needsFacts ? "leader" : needsCoworker ? "coworker" : needsClient ? "client" : "leader";
  if (nextAgent === "leader" && lastActiveAgent === "leader" && !needsLeaderEscalation) {
    nextAgent = needsCoworker ? "coworker" : "client";
  }

  const coworkerName = COWORKER_NAMES[kind];
  const clientName = CLIENT_NAMES[kind];

  const unresolved = [
    needsFacts ? "存在无依据假设，需要纠偏" : "",
    needsPlan ? "方案范围或风险说明不清" : "",
    needsCoworker ? `${coworkerName}协作边界不清` : "",
    needsClient ? `${clientName}预期管理不清` : ""
  ].filter(Boolean);
  const proposal = extractDirectorProposal(input);
  const focusText = proposal.text;
  const agentFocusMismatch =
    (proposal.activeAgent === "coworker" && includesAny(focusText, ["客户", "顾客", "预期", "面子", "江师傅", "老周", "影响面", "恢复优先级", "小楠", "接手范围", "方姐", "交付", "口径"])) ||
    (proposal.activeAgent === "client" && includesAny(focusText, ["苏姐", "小林", "员工", "协作边界", "借人", "初衷", "小郑", "客服", "话术", "老郑", "老员工", "元老", "大周", "排期", "数据", "交换条件"])) ||
    (proposal.activeAgent === "leader" && lastActiveAgent === "leader" && !needsLeaderEscalation && (needsCoworker || needsClient));
  const unresolvedMismatch =
    (needsCoworker && proposal.activeAgent === "client" && !needsClient) ||
    (needsClient && proposal.activeAgent === "coworker" && !needsCoworker);

  if (!agentFocusMismatch && !unresolvedMismatch) {
    return JSON.stringify({
      no_change: true,
      conflicts: [],
      memory_conflicts: [],
      correction: null,
      audit_notes: ["Director proposal 与当前状态一致，无需调整。"]
    });
  }

  return JSON.stringify({
    no_change: false,
    conflicts: [{
      type: agentFocusMismatch ? "agent_focus_mismatch" : "unresolved_item_mismatch",
      description: "Director proposal 与当前焦点、上一角色或未解决事项不匹配。",
      severity: "medium"
    }],
    memory_conflicts: [],
    correction: {
      next_agent: nextAgent,
      next_focus: unresolved[0] ?? "最终闭环验证",
      instruction: "只追问、质疑或澄清，不给完整方案",
      blackboard_patch: {
        current_focus: unresolved[0] ?? "最终闭环验证",
        unresolved_items: unresolved,
        evaluation_notes: {
          strengths: [
            progressValue(input, "asked_clarifying_questions") ? "用户有澄清事实意识" : "",
            hasAlternative ? "用户尝试提出可行替代方案" : ""
          ].filter(Boolean),
          risks: progressValue(input, "unsupported_assumption") ? ["用户出现无依据假设"] : [],
          evidence: [`内部群聊第 ${round} 轮：校正下一位角色为 ${nextAgent}`]
        }
      }
    },
    audit_notes: ["发现 Director proposal 与当前状态冲突，因此介入校正。"]
  });
}

// ── Judge ──
function extractBlackboard(input: string): Record<string, unknown> {
  const match = input.match(/(?:Final Blackboard|最终的 Blackboard):\s*(\{[\s\S]*?\})\s*\n\n(?:Group summary|群聊总结):/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function judgeResponse(input: string): string {
  const blackboard = extractBlackboard(input);
  const history = extractHistory(input);

  const sf = (blackboard.scenario_facts ?? {}) as Record<string, unknown>;
  const rawDims = (sf.capability_dimensions as string[]) ?? [];
  // Use capability_dimensions from blackboard — scenario-specific 8-dim names
  const radarNames = rawDims.length >= 8 ? rawDims : rawDims.length === 5
    ? ["共情能力", "情绪控制", "问题解决", "谈判推进", "组织视角"]
    : ["信息辨别", "交付切分", "备选方案", "承诺边界", "向上对齐", "横向协商", "新人赋能", "压力表达"];

  const ub = (blackboard.latest_user_behavior ?? {}) as Record<string, boolean>;
  const up = (blackboard.user_progress ?? {}) as Record<string, boolean>;
  const en = (blackboard.evaluation_notes ?? {}) as {
    strengths?: string[];
    risks?: string[];
    evidence?: string[];
  };

  const hasClarify = Boolean(up.asked_clarifying_questions || up.stated_assumptions);
  const hasCoreFlow = Boolean(up.identified_core_flow || up.used_given_facts);
  const hasRisk = Boolean(up.gave_risk_plan || ub.honest_risk_with_fallback);
  const hasCoworker = Boolean(up.handled_coworker_conflict);
  const hasClient = Boolean(up.managed_client_expectation);
  const hasConcreteAction = Boolean(up.gave_owner || up.gave_timeline || up.gave_risk_plan);
  const hasAlternative = Boolean(up.proposed_viable_alternative);
  const hasCompleteLoop = Boolean(up.final_plan_complete);
  const hasBlame = Boolean(ub.blame_shifting);
  const hasOverPromise = Boolean(ub.over_promise);
  const hasUnsupported = Boolean(ub.unsupported_assumption);
  const takesOwnership = Boolean(ub.takes_ownership);
  const pressureResistant = Boolean(ub.pressure_resistant);

  // Score with 8 dimensions using Chinese names
  const dimKeys = radarNames;
  const rawScores: Record<string, number> = {};
  for (const dim of dimKeys) {
    rawScores[dim] = clampScore(
      6 + (hasCoreFlow ? 2 : 0) + (hasRisk ? 2 : 0) + (hasConcreteAction ? 2 : 0) +
      (hasCoworker ? 2 : 0) + (hasClient ? 2 : 0) + (takesOwnership ? 1 : 0) +
      (hasAlternative ? 1 : 0) - (hasBlame ? 3 : 0) - (hasUnsupported ? 3 : 0) - (hasOverPromise ? 3 : 0)
    );
  }

  const scores: Record<string, number> = {};
  for (const dim of dimKeys) {
    scores[dim] = capScore(rawScores[dim], hasRisk && hasConcreteAction ? 17 : 12);
  }

  if (hasCompleteLoop && !hasOverPromise && !hasUnsupported && !hasBlame) {
    for (const dim of dimKeys) {
      scores[dim] = Math.max(scores[dim], Math.min(20, scores[dim] + 1));
    }
  }
  if (!hasCoworker) {
    for (const dim of dimKeys) {
      scores[dim] = Math.min(scores[dim], scores[dim] - 1);
    }
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxScore = dimKeys.length * 20;
  const ratio = total / maxScore;
  const level = ratio >= 0.85 ? "卓越" : ratio >= 0.7 ? "优秀" : ratio >= 0.55 ? "良好" : ratio >= 0.4 ? "合格" : "待提升";

  const evalEvidence = en.evidence ?? [];
  const evidenceEntries: JudgeReport["evidence"] =
    evalEvidence.length >= 2
      ? evalEvidence.slice(0, 3).map((e) => ({
          dimension: "综合行为证据",
          quote: e,
          analysis: "由 Director 行为检测流水线在对话中标记。"
        }))
      : [{
          dimension: "事实判断",
          quote: hasCoreFlow ? "参与者识别了场景核心目标。" : "未充分捕捉到场景核心目标识别。",
          analysis: "是否理解场景的核心任务与约束。"
        }, {
          dimension: "风险与边界",
          quote: hasRisk ? "参与者说明了风险或兜底方案。" : hasUnsupported ? "参与者存在无依据假设。" : "未捕捉到明确的风险说明。",
          analysis: "是否在压力下保持对未知和风险的诚实表达。"
        }, {
          dimension: "关系处理",
          quote: hasCoworker || hasClient ? "参与者回应了至少一个关键关系方的处境。" : "未捕捉到对关键关系方处境的具体回应。",
          analysis: "是否针对不同角色调整沟通方式。"
        }];

  const strengths: string[] = [];
  if (hasConcreteAction) strengths.push("能提出可执行的具体行动。");
  if (hasRisk) strengths.push("能说明风险和兜底方案，不回避不确定性。");
  if (hasCoworker) strengths.push("能处理同事/员工的协作边界和角色适配。");
  if (hasClient) strengths.push("能管理客户/顾客预期并回应深层关切。");
  if (hasClarify) strengths.push("能主动澄清未知或标注假设。");
  if (hasAlternative) strengths.push("有备选方案意识，不固守单一路径。");
  if (strengths.length === 0) strengths.push("本轮尚未形成明确的行动、风险说明或边界处理。");

  const risks: string[] = [];
  if (hasOverPromise) risks.push("存在过度承诺：在不确定的情况下做了无依据保证。");
  if (hasUnsupported) risks.push("出现无依据假设：将未确认的信息当作确定事实。");
  if (hasBlame) risks.push("存在推责倾向：将问题归咎于他人，没有寻找解决路径。");
  if (ub.avoidance) risks.push("存在回避倾向：面对压力追问时未正面回应。");
  if (ub.premature_solution) risks.push("过早给方案：未充分澄清问题就跳到解决模式。");
  if (risks.length === 0) risks.push("本轮未检测到明显的行为风险。");

  const suggestions: string[] = [];
  if (!hasConcreteAction) suggestions.push("给出具体动作、责任边界和后续同步。");
  if (!hasRisk) suggestions.push("对不确定的事项明确说'未知'或标注假设，不要回避风险。");
  if (!hasCoworker) suggestions.push("关注同事/员工的协作边界，先理解处境再谈条件。");
  if (!hasClient) suggestions.push("回应客户/顾客的深层关切，管理承诺边界。");
  if (hasOverPromise || hasUnsupported) suggestions.push("控制无依据承诺——说清楚不保证什么比说保证什么更可信。");
  if (suggestions.length === 0) suggestions.push("继续保持闭环沟通和结构化表达，注意跨场景适配。");

  const conflictStyle =
    hasCoworker && hasClient && !hasOverPromise ? "协作型"
    : hasBlame ? "回避型"
    : hasOverPromise ? "妥协型"
    : "混合型";

  const dimensionScores: Record<string, number> = {};
  const dimensionAnalysis: Record<string, string> = {};
  const radarChartData: Array<{ name: string; score: number; max: number }> = [];

  for (const key of dimKeys) {
    dimensionScores[key] = scores[key];
    dimensionAnalysis[key] = hasCoreFlow && hasRisk && hasCoworker && hasClient
      ? "该维度表现均衡，核心问题识别、风险说明和人际处理均有覆盖。"
      : hasConcreteAction
        ? "有行动意识，但在深度和覆盖面上还有提升空间。"
        : "该维度需要更多具体行动和判断来支撑。";
    radarChartData.push({ name: key, score: scores[key], max: 20 });
  }

  const report: JudgeReport = {
    total_score: total,
    level,
    dimension_scores: dimensionScores,
    dimension_analysis: dimensionAnalysis,
    conflict_style: conflictStyle,
    summary: "本报告由本地兜底 Judge 生成（基于 Director 行为检测流水线的 behavior flags），用于保证流程不中断；真实模型可用时会优先使用 DeepSeek。",
    strengths,
    risks,
    suggestions,
    evidence: evidenceEntries,
    radar_chart_data: radarChartData,
    final_recommendation: "下一步重点：先给出判断、说明风险、处理协作边界和各方沟通方式，形成从'看到了什么'到'准备怎么做'的完整闭环。"
  };

  return JSON.stringify(report);
}

// ── Main dispatch ──
export async function mockDeepSeekResponse(systemPrompt: string, userPrompt: string): Promise<string> {
  if (systemPrompt.includes("BehaviorDetector Agent")) return behaviorDetectorResponse(userPrompt);
  if (systemPrompt.includes("StageDirector Agent")) return stageDirectorResponse(userPrompt);
  if (systemPrompt.includes("导演 Agent") || systemPrompt.includes("Director Agent")) return directorResponse(userPrompt);
  if (systemPrompt.includes("内部评估 Agent") || systemPrompt.includes("Group Discussion Agent")) return groupResponse(userPrompt);
  if (systemPrompt.includes("裁判 Agent") || systemPrompt.includes("Judge Agent")) return judgeResponse(userPrompt);

  if (
    systemPrompt.includes("leader NPC") || systemPrompt.includes("coworker NPC") || systemPrompt.includes("client NPC") ||
    systemPrompt.includes("陈总") || systemPrompt.includes("苏姐") || systemPrompt.includes("小秋") ||
    systemPrompt.includes("刘总") || systemPrompt.includes("小林") || systemPrompt.includes("江师傅") ||
    systemPrompt.includes("王总") || systemPrompt.includes("小郑") || systemPrompt.includes("老周") ||
    systemPrompt.includes("梁总") || systemPrompt.includes("老郑") || systemPrompt.includes("小楠") ||
    systemPrompt.includes("许主管") || systemPrompt.includes("大周") || systemPrompt.includes("方姐")
  ) {
    return npcResponse(systemPrompt, userPrompt);
  }

  return JSON.stringify({});
}
