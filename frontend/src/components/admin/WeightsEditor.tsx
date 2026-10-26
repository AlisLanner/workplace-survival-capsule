import { useMemo, useState } from "react";
import { GE8_DIMENSIONS } from "../../config/dimensions";
import type { DimensionId, DimensionWeights } from "../../types/admin";

export type WeightsMode = "equal" | "importance" | "numeric" | "free_text";

const IMPORTANCE_OPTIONS = [
  { value: 1, label: "1 几乎不需要" },
  { value: 2, label: "2 次要" },
  { value: 3, label: "3 一般" },
  { value: 4, label: "4 很重要" },
  { value: 5, label: "5 至关重要" }
];

export interface WeightsDraft {
  mode: WeightsMode;
  importance: Record<DimensionId, number>;
  freeText: Record<DimensionId, string>;
  numeric: Record<DimensionId, string>;
}

export function emptyWeightsDraft(initial?: DimensionWeights | null): WeightsDraft {
  return {
    mode: initial?.mode ?? "equal",
    importance: Object.fromEntries(GE8_DIMENSIONS.map((d) => [d.id, initial?.importance?.[d.id as DimensionId] ?? 3])) as Record<DimensionId, number>,
    freeText: Object.fromEntries(GE8_DIMENSIONS.map((d) => [d.id, initial?.free_text?.[d.id as DimensionId] ?? ""])) as Record<DimensionId, string>,
    numeric: Object.fromEntries(GE8_DIMENSIONS.map((d) => [d.id, String(initial?.numeric_input?.[d.id as DimensionId] ?? "")])) as Record<DimensionId, string>
  };
}

/** 本地预览归一化权重（与后端算法一致：数值取正数，评级/大白话按 1—5 归一）。 */
export function previewWeights(draft: WeightsDraft): { weights: Record<string, number>; total: number; invalid: string | null } {
  const raw: Record<string, number> = {};
  let sum = 0;
  for (const d of GE8_DIMENSIONS) {
    let base: number;
    if (draft.mode === "numeric") {
      const value = Number(draft.numeric[d.id as DimensionId]);
      if (!Number.isFinite(value) || value <= 0) {
        return { weights: {}, total: 0, invalid: `${d.name} 的权重必须是大于 0 的数字` };
      }
      base = value;
    } else if (draft.mode === "equal") {
      base = 1;
    } else {
      base = draft.importance[d.id as DimensionId];
    }
    raw[d.id] = base;
    sum += base;
  }
  const weights = Object.fromEntries(GE8_DIMENSIONS.map((d) => [d.id, sum > 0 ? raw[d.id] / sum : 0.125]));
  return { weights, total: sum, invalid: null };
}

export function buildWeightsPayload(draft: WeightsDraft): Record<string, unknown> {
  if (draft.mode === "equal") return { mode: "equal" };
  if (draft.mode === "importance") return { mode: "importance", importance: draft.importance };
  if (draft.mode === "numeric") {
    return {
      mode: "numeric",
      weights: Object.fromEntries(GE8_DIMENSIONS.map((d) => [d.id, Number(draft.numeric[d.id as DimensionId])]))
    };
  }
  return { mode: "free_text", free_text: draft.freeText, importance: draft.importance };
}

export function WeightsEditor({
  draft,
  onChange
}: {
  draft: WeightsDraft;
  onChange: (next: WeightsDraft) => void;
}) {
  const preview = useMemo(() => previewWeights(draft), [draft]);

  return (
    <div className="weights-editor">
      <div className="weights-modes">
        {([
          ["equal", "① 等权（默认）"],
          ["importance", "② 逐维选重要程度"],
          ["free_text", "③ 语言描述"],
          ["numeric", "④ 专业权重数值"]
        ] as Array<[WeightsMode, string]>).map(([mode, label]) => (
          <label key={mode} className={`weights-mode ${draft.mode === mode ? "on" : ""}`}>
            <input
              type="radio"
              name="weights-mode"
              checked={draft.mode === mode}
              onChange={() => onChange({ ...draft, mode })}
            />
            {label}
          </label>
        ))}
      </div>

      {draft.mode === "equal" ? (
        <p className="small muted">八个维度各占 12.5%，加权总分与旧版简单加和完全一致。</p>
      ) : null}

      {draft.mode !== "equal" && draft.mode !== "numeric" ? (
        <p className="small muted">
          {draft.mode === "importance"
            ? "为每个维度选择 1—5 的重要程度（类似岗位分析问卷的重要性量表），系统自动换算权重。"
            : "用一句话描述每个维度对这个岗位的重要性（例如“领导决策最关键，其余一般”），系统会映射为 1—5 重要程度；也可以在下面手动微调评级。"}
        </p>
      ) : null}

      {draft.mode === "numeric" ? (
        <p className="small muted">直接给出每个维度的权重数字（百分比或任意正数，例如 30/20/10…），系统会自动归一化为总和 100%。</p>
      ) : null}

      <div className="weights-table">
        {GE8_DIMENSIONS.map((dim) => {
          const id = dim.id as DimensionId;
          const percent = preview.weights[dim.id] !== undefined ? (preview.weights[dim.id] * 100).toFixed(1) : "—";
          return (
            <div className="weights-row" key={dim.id}>
              <div className="weights-name">
                <b>{dim.name}</b>
                <span className="small muted">{dim.id} · {dim.meaning}</span>
              </div>
              {draft.mode === "importance" || draft.mode === "free_text" ? (
                <div className="weights-inputs">
                  {draft.mode === "free_text" ? (
                    <input
                      className="f-input"
                      placeholder={`这个维度对岗位有多重要？`}
                      value={draft.freeText[id]}
                      onChange={(e) => onChange({ ...draft, freeText: { ...draft.freeText, [id]: e.target.value } })}
                    />
                  ) : null}
                  <div className="importance-picker" role="radiogroup" aria-label={`${dim.name} 重要程度`}>
                    {IMPORTANCE_OPTIONS.map((opt) => (
                      <label key={opt.value} className={`imp ${draft.importance[id] === opt.value ? "on" : ""}`} title={opt.label}>
                        <input
                          type="radio"
                          name={`imp-${dim.id}`}
                          checked={draft.importance[id] === opt.value}
                          onChange={() => onChange({ ...draft, importance: { ...draft.importance, [id]: opt.value } })}
                        />
                        {opt.value}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              {draft.mode === "numeric" ? (
                <input
                  className="f-input weights-num"
                  type="number"
                  min={0.01}
                  step="any"
                  placeholder="如 20"
                  value={draft.numeric[id]}
                  onChange={(e) => onChange({ ...draft, numeric: { ...draft.numeric, [id]: e.target.value } })}
                />
              ) : null}
              <div className="weights-preview">
                <div className="track"><div className="fill" style={{ width: `${Math.min(100, (preview.weights[dim.id] ?? 0) * 500)}%` }} /></div>
                <span className="small">{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
      {preview.invalid ? <p className="error-box">{preview.invalid}</p> : null}
      <p className="small muted">换算规则：权重 = 各维重要程度 ÷ 八维重要程度之和；加权总分 = 8 × Σ(维度权重 × 维度得分)，满分 160 分。</p>
    </div>
  );
}

export function WeightsSummary({ weights }: { weights: DimensionWeights }) {
  const equal = GE8_DIMENSIONS.every((d) => Math.abs((weights.weights?.[d.id as DimensionId] ?? 0.125) - 0.125) < 0.0001);
  return (
    <div className="weights-summary">
      {equal ? (
        <span className="chip">八维等权 12.5% × 8</span>
      ) : (
        GE8_DIMENSIONS.map((d) => {
          const w = weights.weights?.[d.id as DimensionId] ?? 0;
          return (
            <span key={d.id} className={`chip ${w >= 0.16 ? "hot" : ""}`}>
              {d.name} {(w * 100).toFixed(1)}%
            </span>
          );
        })
      )}
    </div>
  );
}
