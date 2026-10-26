/** 内置情境 id ↔ 编号映射（A/B/C/E 正式，D 旧版演示）。 */
export const BUILTIN_IDS: Record<string, string> = {
  A: "project_demo_crisis",
  B: "coffee_shop_complaint",
  C: "promo_outage_crisis",
  D: "handover_review_crisis",
  E: "first_week_assignment",
};
export const BUILTIN_CODES: Record<string, string> = Object.fromEntries(Object.entries(BUILTIN_IDS).map(([code, id]) => [id, code]));
