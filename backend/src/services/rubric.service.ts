import type { AgentName } from "../types/agent";

export interface ScenarioRubric {
  scenarioId: string;
  requiredElements: string[];
  dimensionDefinitions: Record<string, string>;
  disqualifyingRisks: string[];
}

export function inferScenarioIdFromBlackboard(blackboard: {
  scenario_facts?: {
    user_role?: string;
    project?: string;
  };
}): string {
  const text = `${blackboard.scenario_facts?.user_role ?? ""}\n${blackboard.scenario_facts?.project ?? ""}`;
  if (/值班经理|珍味轩|8号桌|后厨|刘总/.test(text)) return "coffee_shop_complaint";
  if (/值班负责人|大促|支付超时|工单|王总|老周|小郑/.test(text)) return "promo_outage_crisis";
  if (/接手|第三周|季度评审|空降|梁总|老郑|小楠/.test(text)) return "handover_review_crisis";
  if (/入职第一周|渠道复盘|数据组|大周|方姐|许主管|复盘报告/.test(text)) return "first_week_assignment";
  return "project_demo_crisis";
}

const projectDemoRubric: ScenarioRubric = {
  scenarioId: "project_demo_crisis",
  requiredElements: [
    "硬截止前交付范围与后续补齐范围",
    "设计稿缺口的可行路径、替代路径和触发条件",
    "协作方资源负载、交换条件和责任边界",
    "低资历执行者的执行边界、参考标准和反馈节奏",
    "风险与不确定项说明"
  ],
  dimensionDefinitions: {
    信息辨别: "区分确认事实、未知项和假设项。",
    交付切分: "区分硬截止前可交付内容和后续补齐内容。",
    备选方案: "提出可执行主路径、替代路径、触发条件和风险。",
    承诺边界: "在不确定和多方压力下，控制保证、责任和风险表述。",
    向上对齐: "给上级可上会的信息结构。",
    横向协商: "对协作方体现互惠、边界和责任承担。",
    新人赋能: "给新人明确执行边界和信任空间。",
    压力表达: "在追问下保持结构化、稳定表达。"
  },
  disqualifyingRisks: ["无依据承诺", "推责", "把未知说成确定", "直接打击弱势方自尊"]
};

const restaurantRubric: ScenarioRubric = {
  scenarioId: "coffee_shop_complaint",
  requiredElements: [
    "现场影响控制和可见补救方式",
    "员工责任、纠错方式和复核标准",
    "后厨协同、流程责任和专业边界",
    "前厅后厨流程改进",
    "今晚处理与长期改进的区分"
  ],
  dimensionDefinitions: {
    利害识别: "识别客人面子、员工信心、厨房信任三类利害。",
    现场止损: "先控制现场可见影响和服务风险。",
    规则边界: "在食品安全、复核、补偿规则内灵活处理。",
    承诺边界: "在不确定和多方压力下，控制保证、责任和风险表述。",
    面子修复: "处理客人在同伴面前的体面损失。",
    员工修复: "处理员工责任、初衷和后续标准。",
    后厨协同: "与资深后厨建立专业协同。",
    系统改进: "把事故转化为可执行流程机制。"
  },
  disqualifyingRisks: ["无原则补偿", "甩锅给员工", "只追责不处理现场", "食品安全边界失守"]
};

const promoOutageRubric: ScenarioRubric = {
  scenarioId: "promo_outage_crisis",
  requiredElements: [
    "恢复顺序与降级取舍",
    "对用户、客服、老板的承诺边界",
    "跨团队信息同步机制",
    "复盘与防复发安排",
    "风险与不确定项说明"
  ],
  dimensionDefinitions: {
    利害识别: "识别用户流失、客服承压、研发排查三类利害与冲突。",
    现场止损: "先明确恢复什么、降级到哪一步，控制可见损失。",
    规则边界: "在发布、权限、赔付规则边界内做决定。",
    承诺边界: "在不确定和多方压力下，控制保证、责任和风险表述。",
    体面修复: "处理用户与客服在公开场合的体面和信任损失。",
    员工修复: "给客服话术、支持、升级路径，不把客服单独晾在前面。",
    跨团队协同: "建立运营、客服、研发之间的信息同步和 owner 机制。",
    系统改进: "把故障转化为根因分析和防复发机制。"
  },
  disqualifyingRisks: ["无依据恢复承诺", "甩锅给客服或研发", "只追责不处理现场", "绕过发布与权限边界"]
};

const handoverReviewRubric: ScenarioRubric = {
  scenarioId: "handover_review_crisis",
  requiredElements: [
    "评审前状态口径与遗留处理",
    "老员工协作条件",
    "新人接手范围与反馈节奏",
    "风险与不确定项说明"
  ],
  dimensionDefinitions: {
    信息辨别: "区分历史承诺里的实数、虚数和待核实项。",
    交付切分: "区分评审前可收敛内容和评审后处理内容。",
    备选方案: "提出可上会主路径、替代路径和触发条件。",
    承诺边界: "在不确定和多方压力下，控制保证、责任和风险表述。",
    向上对齐: "给上级可上会的事实、owner 和风险结构。",
    横向协商: "与老员工建立对等、互信、边界清楚的协作。",
    新人赋能: "给新成员明确接手范围和反馈节奏。",
    压力表达: "在追问和组内舆论下保持结构化、稳定表达。"
  },
  disqualifyingRisks: ["无依据承诺", "拿新人当挡箭牌", "与元老对抗性沟通", "把传闻当事实"]
};

const firstWeekRubric: ScenarioRubric = {
  scenarioId: "first_week_assignment",
  requiredElements: [
    "需求口径与截止确认",
    "数据获取路径与替代方案",
    "对协作方与业务方的边界说明",
    "进度与风险的上向同步",
    "不确定项的诚实标注"
  ],
  dimensionDefinitions: {
    需求澄清: "对模糊需求主动确认口径、范围与截止，不凭猜测开工。",
    优先级判断: "多线任务下分清硬截止与可延后，按影响排顺序。",
    横向协作: "对不配合的协作方提出清晰诉求与对等条件，不硬扛不指责。",
    诚实沟通: "对不确定的事项如实说明，不编造进度或数据。",
    边界表达: "对不合理的排期与要求守住边界，说明依据与替代。",
    向上同步: "主动同步进度、风险与所需支持，给上级可决策的信息。",
    压力表达: "被质疑时保持稳定，就事论事，不慌乱不反击。",
    担当推进: "认领问题、推动闭环，卡住时及时升级。"
  },
  disqualifyingRisks: ["编造数据或进度", "沉默硬扛不升级", "对协作方甩锅指责", "无依据承诺交付"]
};

export function getScenarioRubric(scenarioId: string): ScenarioRubric {
  switch (scenarioId) {
    case "coffee_shop_complaint":
      return restaurantRubric;
    case "promo_outage_crisis":
      return promoOutageRubric;
    case "handover_review_crisis":
      return handoverReviewRubric;
    case "first_week_assignment":
      return firstWeekRubric;
    default:
      return projectDemoRubric;
  }
}

export function getAgentNamesByScenario(scenarioId: string): Record<AgentName, string> {
  switch (scenarioId) {
    case "coffee_shop_complaint":
      return { leader: "刘总", coworker: "小林", client: "江师傅" };
    case "promo_outage_crisis":
      return { leader: "王总", coworker: "小郑", client: "老周" };
    case "handover_review_crisis":
      return { leader: "梁总", coworker: "老郑", client: "小楠" };
    case "first_week_assignment":
      return { leader: "许主管", coworker: "大周", client: "方姐" };
    default:
      return { leader: "陈总", coworker: "苏姐", client: "小秋" };
  }
}
