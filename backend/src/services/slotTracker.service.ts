import type { AgentName } from "../types/agent";

export type EvidenceQuality = "none" | "partial" | "clear";
export type SlotStatus = "unseen" | "probed" | "evidenced" | "insufficient";

export interface SlotDefinition {
  id: string;
  scenarioId: string;
  dimension: string;
  npcTarget: AgentName;
  promptIntent: string;
  priority: number;
}

export interface SlotCoverage {
  slotId: string;
  dimension: string;
  status: SlotStatus;
  evidenceQuality: EvidenceQuality;
  rounds: number[];
  evidenceQuotes: string[];
}

export interface CoverageState {
  scenarioId: string;
  slots: Record<string, SlotCoverage>;
  coveredDimensions: string[];
  insufficientDimensions: string[];
}

export interface CoverageStatus {
  covered_dimensions: string[];
  insufficient_dimensions: string[];
  complete: boolean;
}

export interface DimensionEvidence {
  dimension: string;
  quality: EvidenceQuality | string;
  quote?: string;
  reason?: string;
}

const projectDemoSlots: SlotDefinition[] = [
  { id: "A_INFO_LEADER", scenarioId: "project_demo_crisis", dimension: "信息辨别", npcTarget: "leader", promptIntent: "暴露用户是否能说明事实、未知和假设的区分依据。", priority: 5 },
  { id: "A_INFO_SCOPE", scenarioId: "project_demo_crisis", dimension: "信息辨别", npcTarget: "client", promptIntent: "暴露用户面对执行者信息不足时如何澄清、标注或延迟判断。", priority: 4 },
  { id: "A_DELIVERY_SCOPE", scenarioId: "project_demo_crisis", dimension: "交付切分", npcTarget: "leader", promptIntent: "暴露用户是否能区分硬截止前范围和后续补齐范围。", priority: 4 },
  { id: "A_DELIVERY_RISK", scenarioId: "project_demo_crisis", dimension: "交付切分", npcTarget: "client", promptIntent: "暴露用户是否能把执行者可交付范围、反馈节奏和后续补齐拆开。", priority: 4 },
  { id: "A_ALTERNATIVE_A", scenarioId: "project_demo_crisis", dimension: "备选方案", npcTarget: "leader", promptIntent: "暴露用户是否能提出可行路径并说明取舍依据。", priority: 4 },
  { id: "A_ALTERNATIVE_B", scenarioId: "project_demo_crisis", dimension: "备选方案", npcTarget: "coworker", promptIntent: "暴露用户在关键条件不成立时如何调整方案。", priority: 4 },
  { id: "A_BOUNDARY_PROMISE", scenarioId: "project_demo_crisis", dimension: "承诺边界", npcTarget: "leader", promptIntent: "暴露用户是否能识别不能说满的承诺。", priority: 4 },
  { id: "A_BOUNDARY_CHANGE", scenarioId: "project_demo_crisis", dimension: "承诺边界", npcTarget: "coworker", promptIntent: "暴露用户对协作资源的承诺是否保留条件、风险和边界。", priority: 4 },
  { id: "A_UPWARD_STRUCTURE", scenarioId: "project_demo_crisis", dimension: "向上对齐", npcTarget: "leader", promptIntent: "暴露用户向上沟通时是否能组织事实、判断和下一步。", priority: 4 },
  { id: "A_UPWARD_OWNER", scenarioId: "project_demo_crisis", dimension: "向上对齐", npcTarget: "coworker", promptIntent: "暴露用户是否能把协作承诺转化为可向上同步的责任安排。", priority: 4 },
  { id: "A_LATERAL_LOAD", scenarioId: "project_demo_crisis", dimension: "横向协商", npcTarget: "coworker", promptIntent: "暴露用户是否考虑协作方资源负载和约束。", priority: 5 },
  { id: "A_LATERAL_EXCHANGE", scenarioId: "project_demo_crisis", dimension: "横向协商", npcTarget: "coworker", promptIntent: "暴露用户是否能提出对等交换、边界和责任安排。", priority: 4 },
  { id: "A_JUNIOR_STANDARD", scenarioId: "project_demo_crisis", dimension: "新人赋能", npcTarget: "client", promptIntent: "暴露用户是否能给低资历成员明确执行边界。", priority: 5 },
  { id: "A_JUNIOR_TRUST", scenarioId: "project_demo_crisis", dimension: "新人赋能", npcTarget: "client", promptIntent: "暴露用户是否能给低资历成员反馈节奏和自主空间。", priority: 4 },
  { id: "A_PRESSURE_STRUCTURE", scenarioId: "project_demo_crisis", dimension: "压力表达", npcTarget: "leader", promptIntent: "暴露用户在追问下是否能保持结构化表达。", priority: 4 },
  { id: "A_PRESSURE_RECOVER", scenarioId: "project_demo_crisis", dimension: "压力表达", npcTarget: "client", promptIntent: "暴露用户在执行者不确定或焦虑时是否仍能稳定推进和补充依据。", priority: 3 }
];

const restaurantSlots: SlotDefinition[] = [
  { id: "B_STAKEHOLDER_MAP", scenarioId: "coffee_shop_complaint", dimension: "利害识别", npcTarget: "leader", promptIntent: "暴露用户是否能识别现场相关方和不同利害。", priority: 5 },
  { id: "B_STAKEHOLDER_CONFLICT", scenarioId: "coffee_shop_complaint", dimension: "利害识别", npcTarget: "client", promptIntent: "暴露用户如何权衡客人、员工和后厨之间的冲突。", priority: 4 },
  { id: "B_DAMAGE_CONTROL", scenarioId: "coffee_shop_complaint", dimension: "现场止损", npcTarget: "leader", promptIntent: "暴露用户是否能说明现场影响控制和即时动作。", priority: 5 },
  { id: "B_DAMAGE_SEQUENCE", scenarioId: "coffee_shop_complaint", dimension: "现场止损", npcTarget: "leader", promptIntent: "暴露用户是否能解释处理顺序背后的判断依据。", priority: 4 },
  { id: "B_RULE_SAFETY", scenarioId: "coffee_shop_complaint", dimension: "规则边界", npcTarget: "client", promptIntent: "暴露用户是否能守住食品安全和出品复核边界。", priority: 5 },
  { id: "B_RULE_COMPENSATION", scenarioId: "coffee_shop_complaint", dimension: "规则边界", npcTarget: "leader", promptIntent: "暴露用户是否能区分补偿、承诺和门店规则边界。", priority: 4 },
  { id: "B_PROMISE_CUSTOMER", scenarioId: "coffee_shop_complaint", dimension: "承诺边界", npcTarget: "leader", promptIntent: "暴露用户面对客人压力时是否能控制承诺边界。", priority: 5 },
  { id: "B_PROMISE_STAFF", scenarioId: "coffee_shop_complaint", dimension: "承诺边界", npcTarget: "coworker", promptIntent: "暴露用户是否能说明员工、厨房和自己之间的责任边界。", priority: 4 },
  { id: "B_FACE_REPAIR", scenarioId: "coffee_shop_complaint", dimension: "面子修复", npcTarget: "leader", promptIntent: "暴露用户是否能处理公开场合中的体面损失。", priority: 5 },
  { id: "B_FACE_VISIBLE_ACTION", scenarioId: "coffee_shop_complaint", dimension: "面子修复", npcTarget: "leader", promptIntent: "暴露用户是否能提出现场可见的补救动作。", priority: 4 },
  { id: "B_STAFF_INTENT", scenarioId: "coffee_shop_complaint", dimension: "员工修复", npcTarget: "coworker", promptIntent: "暴露用户是否能区分员工初衷、责任和纠错边界。", priority: 5 },
  { id: "B_STAFF_STANDARD", scenarioId: "coffee_shop_complaint", dimension: "员工修复", npcTarget: "coworker", promptIntent: "暴露用户是否能给员工清晰标准和后续纠错方式。", priority: 4 },
  { id: "B_KITCHEN_TRUST", scenarioId: "coffee_shop_complaint", dimension: "后厨协同", npcTarget: "client", promptIntent: "暴露用户是否能与资深后厨建立专业协同。", priority: 5 },
  { id: "B_KITCHEN_FRONT_BACK", scenarioId: "coffee_shop_complaint", dimension: "后厨协同", npcTarget: "client", promptIntent: "暴露用户是否能识别前厅后厨衔接中的流程问题。", priority: 4 },
  { id: "B_SYSTEM_PROCESS", scenarioId: "coffee_shop_complaint", dimension: "系统改进", npcTarget: "client", promptIntent: "暴露用户是否能把事故转化为流程机制改进。", priority: 5 },
  { id: "B_SYSTEM_REVIEW", scenarioId: "coffee_shop_complaint", dimension: "系统改进", npcTarget: "leader", promptIntent: "暴露用户是否能安排复盘、责任和防复发机制。", priority: 3 }
];

const promoOutageSlots: SlotDefinition[] = [
  { id: "C_STAKE_MAP", scenarioId: "promo_outage_crisis", dimension: "利害识别", npcTarget: "leader", promptIntent: "暴露用户是否能识别用户、客服、研发三类利害与冲突。", priority: 5 },
  { id: "C_STAKE_IMPACT", scenarioId: "promo_outage_crisis", dimension: "利害识别", npcTarget: "client", promptIntent: "暴露用户是否能说明业务影响面并权衡各方优先级。", priority: 4 },
  { id: "C_DAMAGE_RECOVER", scenarioId: "promo_outage_crisis", dimension: "现场止损", npcTarget: "leader", promptIntent: "暴露用户是否能说明先恢复什么、降级到哪一步。", priority: 5 },
  { id: "C_DAMAGE_SEQUENCE", scenarioId: "promo_outage_crisis", dimension: "现场止损", npcTarget: "leader", promptIntent: "暴露用户是否能解释恢复顺序背后的判断依据。", priority: 4 },
  { id: "C_RULE_RELEASE", scenarioId: "promo_outage_crisis", dimension: "规则边界", npcTarget: "client", promptIntent: "暴露用户是否能守住发布与权限边界，不绕过流程。", priority: 5 },
  { id: "C_RULE_COMPENSATION", scenarioId: "promo_outage_crisis", dimension: "规则边界", npcTarget: "coworker", promptIntent: "暴露用户是否能区分补偿、承诺与平台规则边界。", priority: 4 },
  { id: "C_PROMISE_USER", scenarioId: "promo_outage_crisis", dimension: "承诺边界", npcTarget: "leader", promptIntent: "暴露用户面对用户和老板压力时是否能控制承诺边界。", priority: 5 },
  { id: "C_PROMISE_STAFF", scenarioId: "promo_outage_crisis", dimension: "承诺边界", npcTarget: "coworker", promptIntent: "暴露用户是否能给客服清晰的承诺边界和升级路径。", priority: 4 },
  { id: "C_FACE_USER", scenarioId: "promo_outage_crisis", dimension: "体面修复", npcTarget: "leader", promptIntent: "暴露用户是否能处理用户在公开场合的体面与信任损失。", priority: 5 },
  { id: "C_FACE_PUBLIC", scenarioId: "promo_outage_crisis", dimension: "体面修复", npcTarget: "coworker", promptIntent: "暴露用户是否能统一对外口径，避免客服被单独晾在前面。", priority: 4 },
  { id: "C_STAFF_SUPPORT", scenarioId: "promo_outage_crisis", dimension: "员工修复", npcTarget: "coworker", promptIntent: "暴露用户是否能给小郑话术、支持和情绪缓冲。", priority: 5 },
  { id: "C_STAFF_ESCALATION", scenarioId: "promo_outage_crisis", dimension: "员工修复", npcTarget: "coworker", promptIntent: "暴露用户是否能定义客服的升级路径和免责边界。", priority: 4 },
  { id: "C_CROSS_SYNC", scenarioId: "promo_outage_crisis", dimension: "跨团队协同", npcTarget: "client", promptIntent: "暴露用户是否能建立运营、客服、研发的信息同步机制。", priority: 5 },
  { id: "C_CROSS_OWNER", scenarioId: "promo_outage_crisis", dimension: "跨团队协同", npcTarget: "client", promptIntent: "暴露用户是否能明确各团队的 owner 与信息边界。", priority: 4 },
  { id: "C_SYSTEM_RCA", scenarioId: "promo_outage_crisis", dimension: "系统改进", npcTarget: "client", promptIntent: "暴露用户是否能安排根因分析与防复发机制。", priority: 5 },
  { id: "C_SYSTEM_REVIEW", scenarioId: "promo_outage_crisis", dimension: "系统改进", npcTarget: "leader", promptIntent: "暴露用户是否能安排复盘、责任与对外说明。", priority: 3 }
];

const handoverReviewSlots: SlotDefinition[] = [
  { id: "D_INFO_FACTS", scenarioId: "handover_review_crisis", dimension: "信息辨别", npcTarget: "leader", promptIntent: "暴露用户是否能区分历史承诺里的实数与虚数。", priority: 5 },
  { id: "D_INFO_SOURCE", scenarioId: "handover_review_crisis", dimension: "信息辨别", npcTarget: "client", promptIntent: "暴露用户面对信息不足时是否向信息持有者核实来源。", priority: 4 },
  { id: "D_DELIVERY_CUT", scenarioId: "handover_review_crisis", dimension: "交付切分", npcTarget: "leader", promptIntent: "暴露用户是否能区分评审前可收敛范围和后续处理范围。", priority: 4 },
  { id: "D_DELIVERY_LEGACY", scenarioId: "handover_review_crisis", dimension: "交付切分", npcTarget: "client", promptIntent: "暴露用户是否能处理上一任遗留承诺的处置安排。", priority: 4 },
  { id: "D_ALTERNATIVE_A", scenarioId: "handover_review_crisis", dimension: "备选方案", npcTarget: "leader", promptIntent: "暴露用户是否能提出可上会路径并说明取舍依据。", priority: 4 },
  { id: "D_ALTERNATIVE_B", scenarioId: "handover_review_crisis", dimension: "备选方案", npcTarget: "coworker", promptIntent: "暴露用户在老员工不配合时如何调整方案。", priority: 4 },
  { id: "D_BOUNDARY_PROMISE", scenarioId: "handover_review_crisis", dimension: "承诺边界", npcTarget: "leader", promptIntent: "暴露用户是否能识别不能说满的承诺。", priority: 4 },
  { id: "D_BOUNDARY_LEGACY", scenarioId: "handover_review_crisis", dimension: "承诺边界", npcTarget: "coworker", promptIntent: "暴露用户对遗留承诺的处置是否保留条件、风险和边界。", priority: 4 },
  { id: "D_UPWARD_STRUCTURE", scenarioId: "handover_review_crisis", dimension: "向上对齐", npcTarget: "leader", promptIntent: "暴露用户向上沟通时是否能组织事实、判断和下一步。", priority: 4 },
  { id: "D_UPWARD_OWNER", scenarioId: "handover_review_crisis", dimension: "向上对齐", npcTarget: "coworker", promptIntent: "暴露用户是否能把协作承诺转化为可向上同步的责任安排。", priority: 4 },
  { id: "D_LATERAL_SENIOR", scenarioId: "handover_review_crisis", dimension: "横向协商", npcTarget: "coworker", promptIntent: "暴露用户是否能与资深员工建立对等、互信的协作条件。", priority: 5 },
  { id: "D_LATERAL_BOUNDARY", scenarioId: "handover_review_crisis", dimension: "横向协商", npcTarget: "coworker", promptIntent: "暴露用户是否能划清与老员工之间的信息使用边界。", priority: 4 },
  { id: "D_JUNIOR_SCOPE", scenarioId: "handover_review_crisis", dimension: "新人赋能", npcTarget: "client", promptIntent: "暴露用户是否能给新成员明确的接手范围。", priority: 5 },
  { id: "D_JUNIOR_FEEDBACK", scenarioId: "handover_review_crisis", dimension: "新人赋能", npcTarget: "client", promptIntent: "暴露用户是否能给新成员反馈节奏和求助空间。", priority: 4 },
  { id: "D_PRESSURE_STRUCTURE", scenarioId: "handover_review_crisis", dimension: "压力表达", npcTarget: "leader", promptIntent: "暴露用户在追问下是否能保持结构化表达。", priority: 4 },
  { id: "D_PRESSURE_REVIEW", scenarioId: "handover_review_crisis", dimension: "压力表达", npcTarget: "client", promptIntent: "暴露用户面对组内舆论压力时是否仍能稳定推进。", priority: 3 }
];

const firstWeekSlots: SlotDefinition[] = [
  { id: "E_CLARIFY_LEADER", scenarioId: "first_week_assignment", dimension: "需求澄清", npcTarget: "leader", promptIntent: "暴露用户对模糊需求是否主动确认口径、范围与截止。", priority: 5 },
  { id: "E_CLARIFY_CLIENT", scenarioId: "first_week_assignment", dimension: "需求澄清", npcTarget: "client", promptIntent: "暴露用户面对业务方补充信息时是否追问依据。", priority: 4 },
  { id: "E_PRIORITY_LEADER", scenarioId: "first_week_assignment", dimension: "优先级判断", npcTarget: "leader", promptIntent: "暴露用户是否分清硬截止与可延后事项。", priority: 5 },
  { id: "E_PRIORITY_CLIENT", scenarioId: "first_week_assignment", dimension: "优先级判断", npcTarget: "client", promptIntent: "暴露用户在需求挤压下是否守住主次。", priority: 4 },
  { id: "E_COLLAB_COWORKER", scenarioId: "first_week_assignment", dimension: "横向协作", npcTarget: "coworker", promptIntent: "暴露用户对不配合的协作方是否提出清晰诉求与对等条件。", priority: 5 },
  { id: "E_COLLAB_EXCHANGE", scenarioId: "first_week_assignment", dimension: "横向协作", npcTarget: "coworker", promptIntent: "暴露用户是否把需求文档化并明确口径责任。", priority: 4 },
  { id: "E_HONEST_LEADER", scenarioId: "first_week_assignment", dimension: "诚实沟通", npcTarget: "leader", promptIntent: "暴露用户对不确定的数据口径是否如实说明而非编造。", priority: 4 },
  { id: "E_HONEST_CLIENT", scenarioId: "first_week_assignment", dimension: "诚实沟通", npcTarget: "client", promptIntent: "暴露用户是否如实同步进度与风险。", priority: 4 },
  { id: "E_BOUNDARY_LEADER", scenarioId: "first_week_assignment", dimension: "边界表达", npcTarget: "leader", promptIntent: "暴露用户在催压下是否守住承诺边界并说明依据。", priority: 4 },
  { id: "E_BOUNDARY_COWORKER", scenarioId: "first_week_assignment", dimension: "边界表达", npcTarget: "coworker", promptIntent: "暴露用户对插队要求是否守住排期与口径边界。", priority: 4 },
  { id: "E_UPWARD_LEADER", scenarioId: "first_week_assignment", dimension: "向上同步", npcTarget: "leader", promptIntent: "暴露用户是否主动同步进度、风险与所需支持。", priority: 5 },
  { id: "E_UPWARD_COWORKER", scenarioId: "first_week_assignment", dimension: "向上同步", npcTarget: "coworker", promptIntent: "暴露用户是否把协作阻塞转成可向上同步的信息。", priority: 3 },
  { id: "E_PRESSURE_LEADER", scenarioId: "first_week_assignment", dimension: "压力表达", npcTarget: "leader", promptIntent: "暴露用户被质疑能力时是否保持稳定、就事论事。", priority: 4 },
  { id: "E_PRESSURE_CLIENT", scenarioId: "first_week_assignment", dimension: "压力表达", npcTarget: "client", promptIntent: "暴露用户面对业务方质疑是否不慌乱不反击。", priority: 4 },
  { id: "E_OWNERSHIP_COWORKER", scenarioId: "first_week_assignment", dimension: "担当推进", npcTarget: "coworker", promptIntent: "暴露用户是否认领问题并推动闭环。", priority: 5 },
  { id: "E_OWNERSHIP_LEADER", scenarioId: "first_week_assignment", dimension: "担当推进", npcTarget: "leader", promptIntent: "暴露用户是否主动升级阻塞而非沉默硬扛。", priority: 4 }
];

export function getSlotDefinitions(scenarioId: string): SlotDefinition[] {
  switch (scenarioId) {
    case "coffee_shop_complaint":
      return restaurantSlots;
    case "promo_outage_crisis":
      return promoOutageSlots;
    case "handover_review_crisis":
      return handoverReviewSlots;
    case "first_week_assignment":
      return firstWeekSlots;
    default:
      return projectDemoSlots;
  }
}

export function createInitialCoverageState(scenarioId: string): CoverageState {
  const slots = Object.fromEntries(
    getSlotDefinitions(scenarioId).map((slot) => [
      slot.id,
      {
        slotId: slot.id,
        dimension: slot.dimension,
        status: "unseen" as const,
        evidenceQuality: "none" as const,
        rounds: [],
        evidenceQuotes: []
      }
    ])
  );
  return computeCoverageSummary({ scenarioId, slots, coveredDimensions: [], insufficientDimensions: [] });
}

function qualityRank(quality: EvidenceQuality): number {
  if (quality === "clear") return 2;
  if (quality === "partial") return 1;
  return 0;
}

function computeCoverageSummary(state: CoverageState): CoverageState {
  const dimensions = [...new Set(Object.values(state.slots).map((slot) => slot.dimension))];
  const coveredDimensions = dimensions.filter((dimension) =>
    Object.values(state.slots).some((slot) => slot.dimension === dimension && qualityRank(slot.evidenceQuality) >= 1)
  );
  return {
    ...state,
    coveredDimensions,
    insufficientDimensions: dimensions.filter((dimension) => !coveredDimensions.includes(dimension))
  };
}

export function getUncoveredSlots(state: CoverageState | undefined): SlotDefinition[] {
  if (!state) return [];
  return getSlotDefinitions(state.scenarioId)
    .filter((slot) => state.slots[slot.id]?.evidenceQuality === "none")
    .sort((a, b) => b.priority - a.priority);
}

export function summarizeCoverage(state: CoverageState | undefined): CoverageStatus {
  if (!state) {
    return { covered_dimensions: [], insufficient_dimensions: [], complete: false };
  }
  return {
    covered_dimensions: state.coveredDimensions,
    insufficient_dimensions: state.insufficientDimensions,
    complete: state.coveredDimensions.length >= 6
  };
}

function dimensionsFromLegacyBehavior(scenarioId: string, detectedBehavior: Record<string, boolean>): string[] {
  if (scenarioId === "first_week_assignment") {
    const entryDimensions: string[] = [];
    if (detectedBehavior.identified_core_flow || detectedBehavior.used_given_facts || detectedBehavior.asked_clarifying_questions) {
      entryDimensions.push("需求澄清");
    }
    if (detectedBehavior.clarified_scope || detectedBehavior.separated_must_have_from_optional) {
      entryDimensions.push("优先级判断");
    }
    if (detectedBehavior.proposed_viable_alternative || detectedBehavior.handled_coworker_conflict) {
      entryDimensions.push("横向协作");
    }
    if (detectedBehavior.gave_risk_plan || detectedBehavior.honest_risk_with_fallback || detectedBehavior.stated_assumptions) {
      entryDimensions.push("诚实沟通");
    }
    if (detectedBehavior.managed_client_expectation) {
      entryDimensions.push("边界表达");
    }
    if (detectedBehavior.gave_owner || detectedBehavior.gave_timeline) {
      entryDimensions.push("向上同步");
    }
    if (detectedBehavior.pressure_resistant) {
      entryDimensions.push("压力表达");
    }
    if (detectedBehavior.takes_ownership) {
      entryDimensions.push("担当推进");
    }
    return [...new Set(entryDimensions)];
  }

  const isCrisisFamily = scenarioId === "coffee_shop_complaint" || scenarioId === "promo_outage_crisis";
  const isPromoOutage = scenarioId === "promo_outage_crisis";
  const dimensions: string[] = [];

  if (detectedBehavior.used_given_facts || detectedBehavior.identified_core_flow) {
    dimensions.push(isCrisisFamily ? "利害识别" : "信息辨别");
  }
  if (detectedBehavior.clarified_scope || detectedBehavior.separated_must_have_from_optional) {
    dimensions.push(isCrisisFamily ? "现场止损" : "交付切分");
  }
  if (detectedBehavior.proposed_viable_alternative || detectedBehavior.gave_risk_plan) {
    dimensions.push(isCrisisFamily ? "系统改进" : "备选方案");
  }
  if (detectedBehavior.honest_risk_with_fallback || detectedBehavior.stated_assumptions) {
    dimensions.push("承诺边界");
  }
  if (detectedBehavior.gave_owner || detectedBehavior.gave_timeline) {
    dimensions.push(isCrisisFamily ? "现场止损" : "向上对齐");
  }
  if (detectedBehavior.handled_coworker_conflict) {
    dimensions.push(isCrisisFamily ? "员工修复" : "横向协商");
  }
  if (detectedBehavior.managed_client_expectation) {
    dimensions.push(isPromoOutage ? "跨团队协同" : isCrisisFamily ? "后厨协同" : "新人赋能");
  }
  if (detectedBehavior.pressure_resistant || detectedBehavior.takes_ownership) {
    dimensions.push(isCrisisFamily ? "承诺边界" : "压力表达");
  }

  return [...new Set(dimensions)];
}

function normalizeEvidenceQuality(quality: string | undefined): EvidenceQuality {
  if (quality === "clear" || quality === "partial" || quality === "none") return quality;
  return "none";
}

export function updateCoverageFromDimensionEvidence(
  state: CoverageState | undefined,
  scenarioId: string,
  dimensionEvidence: DimensionEvidence[] | undefined,
  round: number
): CoverageState {
  const next = state ?? createInitialCoverageState(scenarioId);
  if (!dimensionEvidence || dimensionEvidence.length === 0) {
    return next;
  }

  const validDimensions = new Set(getSlotDefinitions(scenarioId).map((slot) => slot.dimension));
  const slots = { ...next.slots };

  for (const evidence of dimensionEvidence) {
    if (!validDimensions.has(evidence.dimension)) continue;
    const quality = normalizeEvidenceQuality(evidence.quality);
    if (quality === "none") continue;

    const target =
      getSlotDefinitions(scenarioId).find((slot) =>
        slot.dimension === evidence.dimension &&
        qualityRank(slots[slot.id]?.evidenceQuality ?? "none") < qualityRank(quality)
      ) ??
      getSlotDefinitions(scenarioId).find((slot) => slot.dimension === evidence.dimension);
    if (!target) continue;

    const current = slots[target.id];
    slots[target.id] = {
      ...current,
      status: "evidenced",
      evidenceQuality: quality,
      rounds: current.rounds.includes(round) ? current.rounds : [...current.rounds, round],
      evidenceQuotes: evidence.quote
        ? [...current.evidenceQuotes, evidence.quote.slice(0, 200)]
        : current.evidenceQuotes
    };
  }

  return computeCoverageSummary({ ...next, slots });
}

export function updateCoverageFromLegacyBehavior(
  state: CoverageState | undefined,
  scenarioId: string,
  detectedBehavior: Record<string, boolean> | undefined,
  round: number,
  quote: string
): CoverageState {
  const next = state ?? createInitialCoverageState(scenarioId);
  if (!detectedBehavior) {
    return next;
  }

  const dimensions = dimensionsFromLegacyBehavior(scenarioId, detectedBehavior);
  const slots = { ...next.slots };
  for (const dimension of dimensions) {
    const target = getSlotDefinitions(scenarioId).find((slot) => slot.dimension === dimension && slots[slot.id]?.evidenceQuality === "none");
    if (!target) continue;
    const current = slots[target.id];
    slots[target.id] = {
      ...current,
      status: "evidenced",
      evidenceQuality: "partial",
      rounds: [...current.rounds, round],
      evidenceQuotes: quote ? [...current.evidenceQuotes, quote.slice(0, 200)] : current.evidenceQuotes
    };
  }

  return computeCoverageSummary({ ...next, slots });
}
