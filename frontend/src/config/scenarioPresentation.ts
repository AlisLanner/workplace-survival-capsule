import type { CSSProperties } from "react";
import meetingImage from "../assets/scenarios/scenario-meeting.webp";
import restaurantImage from "../assets/scenarios/scenario-restaurant.webp";
import outageImage from "../assets/scenarios/scenario-outage.svg";
import handoverImage from "../assets/scenarios/scenario-handover.svg";
import firstWeekImage from "../assets/scenarios/scenario-firstweek.svg";

export interface ScenarioPresentation {
  badge: string;
  tagline: string;
  backgroundImage: string;
  accent: string;
  accentRgb: string;
}

type SceneStyle = CSSProperties & Record<`--${string}`, string>;
export type ScenarioPresentationInput =
  | string
  | {
      id?: string | null;
      title?: string | null;
      description?: string | null;
      backgroundForUser?: string | null;
    };

const defaultPresentation: ScenarioPresentation = {
  badge: "综合压力",
  tagline: "Multi-Agent 动态追问 · 多维度行为观察",
  backgroundImage: meetingImage,
  accent: "#b63f2e",
  accentRgb: "182, 63, 46"
};

const scenarioPresentations: Record<string, ScenarioPresentation> = {
  project_demo_crisis: {
    badge: "会议室压力",
    tagline: "信息辨别 · 交付切分 · 备选方案 · 压力表达",
    backgroundImage: meetingImage,
    accent: "#b63f2e",
    accentRgb: "182, 63, 46"
  },
  coffee_shop_complaint: {
    badge: "人情危机",
    tagline: "利害识别 · 现场止损 · 面子修复 · 系统改进",
    backgroundImage: restaurantImage,
    accent: "#8d5f26",
    accentRgb: "141, 95, 38"
  },
  promo_outage_crisis: {
    badge: "服务事故",
    tagline: "现场止损 · 跨团队协同 · 系统改进",
    backgroundImage: outageImage,
    accent: "#2f6f68",
    accentRgb: "47, 111, 104"
  },
  handover_review_crisis: {
    badge: "管理接盘",
    tagline: "信息辨别 · 向上对齐 · 新人赋能",
    backgroundImage: handoverImage,
    accent: "#5f6472",
    accentRgb: "95, 100, 114"
  },
  first_week_assignment: {
    badge: "新人困境",
    tagline: "需求澄清 · 边界表达 · 求助担当",
    backgroundImage: firstWeekImage,
    accent: "#6f7d3a",
    accentRgb: "111, 125, 58"
  }
};

const scenarioAliases: Record<string, keyof typeof scenarioPresentations> = {
  project_demo: "project_demo_crisis",
  project_demo_crisis: "project_demo_crisis",
  project_demo_case: "project_demo_crisis",
  meeting_room_crisis: "project_demo_crisis",
  wednesday_meeting_room: "project_demo_crisis",
  q3_design_gap: "project_demo_crisis",
  q3_report_crisis: "project_demo_crisis",
  coffee_shop_complaint: "coffee_shop_complaint",
  restaurant_complaint: "coffee_shop_complaint",
  restaurant_dish: "coffee_shop_complaint",
  table_8_complaint: "coffee_shop_complaint",
  promo_outage: "promo_outage_crisis",
  promo_outage_crisis: "promo_outage_crisis",
  outage_crisis: "promo_outage_crisis",
  payment_outage: "promo_outage_crisis",
  promo_payment_crisis: "promo_outage_crisis",
  大促: "promo_outage_crisis",
  支付: "promo_outage_crisis",
  工单: "promo_outage_crisis",
  王总: "promo_outage_crisis",
  老周: "promo_outage_crisis",
  小郑: "promo_outage_crisis",
  handover_review: "handover_review_crisis",
  handover_review_crisis: "handover_review_crisis",
  handover_crisis: "handover_review_crisis",
  review_crisis: "handover_review_crisis",
  接手: "handover_review_crisis",
  第三周: "handover_review_crisis",
  评审: "handover_review_crisis",
  空降: "handover_review_crisis",
  梁总: "handover_review_crisis",
  老郑: "handover_review_crisis",
  小楠: "handover_review_crisis",
  first_week: "first_week_assignment",
  first_week_assignment: "first_week_assignment",
  onboarding_assignment: "first_week_assignment",
  vague_brief: "first_week_assignment",
  入职第一周: "first_week_assignment",
  新人: "first_week_assignment",
  需求对接: "first_week_assignment",
  许主管: "first_week_assignment",
  大周: "first_week_assignment",
  方姐: "first_week_assignment",
  复盘报告: "first_week_assignment",
  渠道复盘: "first_week_assignment"
};

function normalizeScenarioToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function resolveDirectKey(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeScenarioToken(value);
  return scenarioPresentations[normalized] ? normalized : scenarioAliases[normalized] ?? null;
}

function resolveKeyFromSearchableText(searchable: string) {
  const normalized = searchable.toLowerCase();

  if (/8号桌|刘总|珍味轩|餐厅|后厨|菜品|江师傅|小林/.test(searchable)) {
    return "coffee_shop_complaint";
  }

  if (/\b(table[_\s-]?8|restaurant|dish|chef|kitchen|complaint)\b/.test(normalized)) {
    return "coffee_shop_complaint";
  }

  if (/周三下午|会议室|陈总|VP|CEO|Q3|设计稿|assumption|汇报|小秋|苏姐/.test(searchable)) {
    return "project_demo_crisis";
  }

  if (/\b(q3|vp|ceo|meeting|deck|design[_\s-]?gap|assumption|owner)\b/.test(normalized)) {
    return "project_demo_crisis";
  }

  if (/零点大促|大促|支付超时|支付通道|支付|工单|王总|老周|小郑|服务事故|跨团队协同|系统改进/.test(searchable)) {
    return "promo_outage_crisis";
  }

  if (/\b(promo|payment|outage|ticket|incident|degrade)\b/.test(normalized)) {
    return "promo_outage_crisis";
  }

  if (/接手的第三周|接手|第三周|评审|空降|梁总|老郑|小楠|管理接盘|新人赋能|事业部/.test(searchable)) {
    return "handover_review_crisis";
  }

  if (/\b(handover|takeover|quarterly[_\s-]?review|mentor|onboard)\b/.test(normalized)) {
    return "handover_review_crisis";
  }

  if (/入职第一周|渠道复盘|复盘报告|数据组|大周|方姐|许主管|新人困境|需求对接|新人|排期/.test(searchable)) {
    return "first_week_assignment";
  }

  if (/\b(first[_\s-]?week|onboarding|onboard|vague[_\s-]?brief|report[_\s-]?request|data[_\s-]?access)\b/.test(normalized)) {
    return "first_week_assignment";
  }

  return null;
}

function resolveScenarioKey(input?: ScenarioPresentationInput | null) {
  if (!input) {
    return null;
  }

  if (typeof input === "string") {
    return resolveDirectKey(input) ?? resolveKeyFromSearchableText(input);
  }

  const directKey = resolveDirectKey(input.id);
  if (directKey) {
    return directKey;
  }

  const searchable = [
    input.id,
    input.title,
    input.description,
    input.backgroundForUser
  ]
    .filter(Boolean)
    .join(" ");

  return resolveKeyFromSearchableText(searchable);
}

export function getScenarioPresentation(input?: ScenarioPresentationInput | null) {
  const key = resolveScenarioKey(input);
  return key ? scenarioPresentations[key] : defaultPresentation;
}

export function getScenarioSceneStyle(input?: ScenarioPresentationInput | null): SceneStyle {
  const presentation = getScenarioPresentation(input);
  const accentLight = `rgba(${presentation.accentRgb}, 0.08)`;
  const accentGlow = `rgba(${presentation.accentRgb}, 0.2)`;

  return {
    "--accent": presentation.accent,
    "--accent-rgb": presentation.accentRgb,
    "--accent-deep": presentation.accent,
    "--accent-light": accentLight,
    "--accent-glow": accentGlow,
    "--scene-image": `url(${presentation.backgroundImage})`,
    "--scene-accent": presentation.accent,
    "--scene-accent-rgb": presentation.accentRgb,
    "--scenario-image": `url(${presentation.backgroundImage})`
  };
}
