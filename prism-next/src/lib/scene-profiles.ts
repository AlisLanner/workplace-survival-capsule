/** 真实情境 ↔ 棱镜视觉档案：内置 A/B/C/E 沿用预览视觉，其余情境生成档案并注册供跨页飞牌使用。 */
import { scenes as builtinScenes, type Scene } from "./content";
import type { Scenario } from "./types";

/** 可变的场景档案结构（内置 as const 场景只读，自定义档案需要完整构造）。 */
type Profile = { code: string; title: string; line1: string; line2: string; category: string; role: string; summary: string; prompt: string; copy: string; people: string[]; tone: string; art: string };

const BUILTIN_BY_ID: Record<string, string> = {
  project_demo_crisis: "A",
  coffee_shop_complaint: "B",
  promo_outage_crisis: "C",
  handover_review_crisis: "D",
  first_week_assignment: "E",
};
const EXTRA_TONES = ["#9ab8c9", "#c6b194", "#9eabcc", "#a7bfae", "#b5acbe", "#93b8d9", "#a3a5d4", "#bf9bc9"];
const EXTRA_ART = ["meeting", "service", "incident", "newcomer"] as const;

/** 卡牌/封面运行时注册表：route-transition 的跨页飞牌据此取视觉档案。 */
const registry = new Map<string, Scene>();
builtinScenes.forEach(scene => registry.set(scene.code, scene as Scene));

function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) result = (result * 31 + value.charCodeAt(i)) | 0;
  return result;
}

function splitTitle(title: string): [string, string] {
  const cut = Math.ceil(title.length / 2);
  return title.length > 6 ? [title.slice(0, cut), title.slice(cut)] : [title, " "];
}

export function getSceneProfile(code: string): Scene {
  return registry.get(code) ?? buildProfile(code, `情境 ${code}`, {});
}

function buildProfile(code: string, title: string, overrides: Partial<Profile>): Scene {
  const index = Math.abs(hash(code)) % 8;
  const [line1, line2] = splitTitle(title);
  return {
    code, title, line1, line2,
    category: "自定义情境", role: "", summary: "", prompt: "", copy: "", people: [],
    tone: EXTRA_TONES[index], art: EXTRA_ART[index % EXTRA_ART.length],
    ...overrides,
  } as unknown as Scene;
}

export interface SceneEntry { key: string; scenario: Scenario; scene: Scene }

/** 把后端情境列表转换为带视觉档案的入口；同时注册自定义档案供飞牌动画使用。 */
export function toSceneEntries(scenarios: Scenario[]): SceneEntry[] {
  const entries: SceneEntry[] = [];
  for (const scenario of scenarios) {
    if (scenario.status !== "active") continue;
    const code = BUILTIN_BY_ID[scenario.id];
    if (code && code !== "D") {
      entries.push({ key: code, scenario, scene: builtinScenes.find(item => item.code === code) as Scene });
    } else if (code === "D") {
      const legacy = buildProfile("D", scenario.title, { category: "旧版演示", role: "空降负责人", copy: scenario.backgroundForUser, summary: "单独保留的旧版演示情境。" });
      registry.set("D", legacy);
      entries.push({ key: "D", scenario, scene: legacy });
    } else {
      const profile = buildProfile(scenario.id, scenario.title, {
        category: scenario.origin === "custom" ? "自定义情境" : "情境",
        role: scenario.description.split(" · ").at(-1) ?? "",
        copy: scenario.backgroundForUser,
        summary: scenario.description,
      });
      registry.set(scenario.id, profile);
      entries.push({ key: scenario.id, scenario, scene: profile });
    }
  }
  return entries;
}

/** 路由键 → 后端情境：内置按 A—E 编号，其余键就是 scenario.id。 */
export function resolveScenarioKey(key: string): { code?: string; id?: string } {
  if (/^[A-Z]$/.test(key)) {
    const id = Object.keys(BUILTIN_BY_ID).find(item => BUILTIN_BY_ID[item] === key);
    return id ? { code: key, id } : {};
  }
  return { id: key };
}
