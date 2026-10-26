export const DIMENSION_LABELS: Record<string, string> = {
  empathy: "共情能力",
  emotional_control: "情绪控制",
  problem_solving: "问题解决",
  negotiation: "谈判推进",
  organizational_perspective: "组织视角",
  information_gathering: "信息获取",
  decision_structure: "决策结构",
  interpersonal_adaptation: "人际适配",
  pressure_expression: "压力表达",
  ownership: "责任承担",
  systems_perspective: "系统视角"
};

/** 统一八维（GE8）：id 顺序即测量契约顺序，与后端注册表一致。 */
export const GE8_DIMENSIONS: Array<{ id: string; name: string; meaning: string }> = [
  { id: "GE01", name: "领导与决策", meaning: "在职责范围内作出选择、发起行动并担责；有管理职责时还观察指导与授权。" },
  { id: "GE02", name: "支持与合作", meaning: "理解并尊重他人，提供支持、共同处理问题；如实说明情况并遵守诚信原则。" },
  { id: "GE03", name: "互动与呈现", meaning: "针对沟通对象组织信息、说明理由、协商分歧，使对方能够理解并作出回应。" },
  { id: "GE04", name: "分析与解释", meaning: "区分事实、未知与假设，核验关键依据，分析原因、影响和不同选择的后果。" },
  { id: "GE05", name: "创造与概念化", meaning: "学习并吸收新信息，提出有针对性的新思路或改进机制，解释其如何解决问题。" },
  { id: "GE06", name: "组织与执行", meaning: "把目标转为优先级、责任、时间与检查安排，遵循已知程序并保障交付质量。" },
  { id: "GE07", name: "适应与应对", meaning: "关键条件变化后调整做法，受到催促、批评或挫折时仍能回应问题并推进任务。" },
  { id: "GE08", name: "进取与绩效", meaning: "提出与职责相称的工作提升目标，权衡业务价值、投入与成本；说明为何值得争取。" }
];

export function ge8Name(id: string): string {
  return GE8_DIMENSIONS.find((d) => d.id === id)?.name ?? id;
}

export const DIMENSION_PALETTE = [
  "#b63f2e",
  "#6f7d3a",
  "#8d5f26",
  "#9b3b45",
  "#2f6f68",
  "#5f6472",
  "#7a4a28",
  "#353934"
];

export function getDimensionLabel(key: string): string {
  return DIMENSION_LABELS[key] ?? GE8_DIMENSIONS.find((d) => d.id === key)?.name ?? key;
}

export function getDimensionColor(dimensions: string[], key: string): string {
  const idx = dimensions.indexOf(key);
  return DIMENSION_PALETTE[idx >= 0 ? idx % DIMENSION_PALETTE.length : 0];
}
