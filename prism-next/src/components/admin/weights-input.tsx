"use client";
import { domains } from "@/lib/content";
import type { DimensionWeights } from "@/lib/types";
import { cn } from "@/lib/utils";

export type WeightsMode = "equal" | "importance" | "free_text" | "numeric";
export interface WeightsDraft {
  mode: WeightsMode;
  importance: number[];
  freeText: string[];
  numeric: string[];
}

export function emptyWeightsDraft(initial?: DimensionWeights | null): WeightsDraft {
  return {
    mode: initial?.mode ?? "equal",
    importance: domains.map((_, index) => initial?.importance?.[`GE0${index + 1}` as "GE01"] ?? 3),
    freeText: domains.map((_, index) => initial?.free_text?.[`GE0${index + 1}` as "GE01"] ?? ""),
    numeric: domains.map((_, index) => String(initial?.numeric_input?.[`GE0${index + 1}` as "GE01"] ?? "")),
  };
}

/** 本地预览归一化权重（与后端口径一致：数值取正数，评级/语言描述按 1—5 归一）。 */
export function previewWeights(draft: WeightsDraft): { weights: number[]; invalid: string | null } {
  const base = domains.map((_, index) => {
    if (draft.mode === "numeric") return Number(draft.numeric[index]);
    if (draft.mode === "equal") return 1;
    return draft.importance[index];
  });
  if (draft.mode === "numeric" && base.some(value => !Number.isFinite(value) || value <= 0)) {
    return { weights: domains.map(() => 0.125), invalid: "权重需要是大于 0 的数字" };
  }
  const total = base.reduce((sum, value) => sum + value, 0);
  return { weights: base.map(value => (total > 0 ? value / total : 0.125)), invalid: null };
}

export function buildWeightsPayload(draft: WeightsDraft): Record<string, unknown> {
  if (draft.mode === "equal") return { mode: "equal" };
  if (draft.mode === "importance") return { mode: "importance", importance: Object.fromEntries(domains.map((_, index) => [`GE0${index + 1}`, draft.importance[index]])) };
  if (draft.mode === "numeric") return { mode: "numeric", weights: Object.fromEntries(domains.map((_, index) => [`GE0${index + 1}`, Number(draft.numeric[index])])) };
  return { mode: "free_text", free_text: Object.fromEntries(domains.map((_, index) => [`GE0${index + 1}`, draft.freeText[index]])), importance: Object.fromEntries(domains.map((_, index) => [`GE0${index + 1}`, draft.importance[index]])) };
}

const IMPORTANCE_OPTIONS = [1, 2, 3, 4, 5];

/** 四种权重输入模式（等权/重要程度/语言描述/专业数值），向导与详情共用。 */
export function WeightsInput({ draft, onChange }: { draft: WeightsDraft; onChange: (next: WeightsDraft) => void }) {
  const preview = previewWeights(draft);
  return <div className="grid gap-5">
    <div className="flex flex-wrap gap-2">{([["equal", "① 等权（默认）"], ["importance", "② 逐维选重要程度"], ["free_text", "③ 语言描述"], ["numeric", "④ 专业权重数值"]] as Array<[WeightsMode, string]>).map(([mode, label]) => (
      <button key={mode} type="button" onClick={() => onChange({ ...draft, mode })} className={cn("cursor-pointer rounded-lg border px-3.5 py-2 text-[10.5px] transition-colors", draft.mode === mode ? "border-sky-100/40 bg-sky-100/[.06] text-sky-100" : "border-white/10 bg-white/[.02] text-slate-500 hover:text-slate-200")}>{label}</button>
    ))}</div>
    {draft.mode === "equal" ? <p className="text-[10px] leading-6 text-slate-500">八个维度各占 12.5%。</p> : draft.mode === "importance" ? <p className="text-[10px] leading-6 text-slate-500">为每个维度选择 1—5 的重要程度（1=几乎不需要，5=至关重要），系统自动换算权重。</p> : draft.mode === "free_text" ? <p className="text-[10px] leading-6 text-slate-500">用一句话描述每个维度对这个岗位的重要性，系统会映射为 1—5 重要程度；也可以手动微调评级。</p> : <p className="text-[10px] leading-6 text-slate-500">直接给出每个维度的权重数字（百分比或任意正数），系统自动归一化为总和 100%。</p>}
    <div className="grid gap-3">{domains.map((domain, index) => (
      <div key={domain.name} className="grid items-center gap-3 rounded-xl border border-white/[.055] bg-white/[.012] px-4 py-3.5 md:grid-cols-[170px_1fr_150px]">
        <div><p className="flex items-center gap-2 text-[11px] text-slate-300"><span className="size-1.5 rounded-full" style={{ background: domain.tone }} />{domain.name}</p><p className="mt-1 line-clamp-2 text-[9px] leading-5 text-slate-600">{domain.description}</p></div>
        <div className="grid gap-2">
          {draft.mode === "free_text" ? <input value={draft.freeText[index]} onChange={event => { const next = [...draft.freeText]; next[index] = event.target.value; onChange({ ...draft, freeText: next }); }} placeholder="这个维度对岗位有多重要？" maxLength={80} className="h-9 rounded-lg border border-white/10 bg-white/[.025] px-3 text-[11px] text-slate-200 placeholder:text-slate-700 focus:border-sky-100/30 focus:outline-none" /> : null}
          {draft.mode === "importance" || draft.mode === "free_text" ? <div className="flex gap-1.5" role="radiogroup" aria-label={`${domain.name}重要程度`}>{IMPORTANCE_OPTIONS.map(option => (
            <button key={option} type="button" aria-pressed={draft.importance[index] === option} onClick={() => { const next = [...draft.importance]; next[index] = option; onChange({ ...draft, importance: next }); }} className={cn("h-8 w-9 cursor-pointer rounded-lg border text-[11px] transition-colors", draft.importance[index] === option ? "border-sky-100/45 bg-sky-100/[.07] font-semibold text-sky-100" : "border-white/10 text-slate-500 hover:text-slate-300")}>{option}</button>
          ))}</div> : null}
          {draft.mode === "numeric" ? <input type="number" min="0.01" step="any" value={draft.numeric[index]} onChange={event => { const next = [...draft.numeric]; next[index] = event.target.value; onChange({ ...draft, numeric: next }); }} placeholder="如 20" className="h-9 w-28 rounded-lg border border-white/10 bg-white/[.025] px-3 text-[11px] text-slate-200 placeholder:text-slate-700 focus:border-sky-100/30 focus:outline-none" /> : null}
        </div>
        <div className="flex items-center gap-2.5"><div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, preview.weights[index] * 500)}%`, background: `${domain.tone}99` }} /></div><span className="w-12 shrink-0 text-right font-mono text-[9px] text-slate-500">{(preview.weights[index] * 100).toFixed(1)}%</span></div>
      </div>
    ))}</div>
    {preview.invalid ? <p className="text-[10px] text-rose-300/80" role="alert">{preview.invalid}</p> : null}
    <p className="text-[9px] leading-6 text-slate-600">换算规则：权重 = 各维重要程度 ÷ 八维重要程度之和；加权总分 = 8 × Σ(维度权重 × 维度得分)，满分 160 分。</p>
  </div>;
}
