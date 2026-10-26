"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Scale, Quote, ShieldAlert, RefreshCw } from "lucide-react";
import { getSession, getReport } from "@/lib/api";
import type { Report } from "@/lib/types";
import { domains } from "@/lib/content";
import { TransitionLink as Link } from "./transition-link";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";

const dimStatus: Record<string, string> = { rated: "已评分", not_observed: "未观察", insufficient: "证据不足", scoring_failed: "评分技术失败" };
const reviewLabels: Record<string, string> = {
  valid_samples_below_five: "合法评分样本不足五份", total_variance_limit: "五次总分波动达到复核阈值",
  dimension_disagreement: "五次评分分歧较大", aggregate_explanation_crosses_band: "聚合分档缺少一致解释",
};

/** 正式行为观察报告：八维、加权、原话证据与复核状态，口径与 Ge8Report 一致，视觉套用棱镜主题。 */
export function ReportView({ sessionId, embedded = false }: { sessionId: string; embedded?: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [title, setTitle] = useState("评估会话");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getSession(sessionId)
      .then(detail => {
        setTitle(detail.scenario?.title ?? "评估会话");
        if (detail.session.status === "finished" && detail.report) setReport(detail.report);
        else return getReport(sessionId).then(setReport);
      })
      .catch(err => setError(err instanceof Error ? err.message : "报告读取失败"));
  }, [sessionId]);

  const dims = report?.dimension_results ?? [];
  const complete = dims.length === 8 && dims.every(dim => dim.status === "rated" && dim.score !== null);
  const stable = report?.report_status === "confident";

  if (error) return <Shell><div className="rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-10 text-center text-[12px] text-rose-200/80" role="alert">{error}</div></Shell>;
  if (!report) return <Shell><div className="grid h-[280px] place-items-center text-[13px] text-slate-600" role="status">正在读取行为观察报告…</div></Shell>;

  const weighted = report.weighted_scores ?? null;

  return <Shell title={title} embedded={embedded}>
    <section className="rounded-2xl border border-white/[.075] bg-[#0f1721]/70 p-7 md:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><p className="font-mono text-[10px] tracking-[.22em] text-slate-500">BEHAVIOR REPORT</p><Badge variant="outline" className="border-white/10 bg-white/[.02] px-2.5 py-1 text-[11px] font-normal text-slate-400">{report.mock_generated ? "模拟调试" : stable ? "评分稳定性检查通过" : "建议复核"}</Badge></div>
          <h1 className="mt-4 text-[26px] font-normal tracking-tight text-slate-100">{title}</h1>
          <p className="mt-3 max-w-[640px] text-[12px] leading-7 text-slate-500">{report.summary}</p>
          <p className="mt-2 font-mono text-[10px] tracking-widest text-slate-700">{report.assessment_version}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] tracking-[.2em] text-slate-600">TOTAL / 160</p>
          <p className="mt-2 font-mono text-[38px] leading-none text-slate-100">{report.total_score === null ? "—" : report.total_score}</p>
          {weighted ? <p className="mt-3 text-[12px] text-sky-100/70">加权 {weighted.weighted_total} · {weighted.weighted_percent}%</p> : <p className="mt-3 text-[12px] text-slate-600">总分暂不报告</p>}
        </div>
      </div>
      {report.report_status === "scoring_failed" ? <p className="mt-5 rounded-lg border border-rose-300/20 bg-rose-300/[.04] px-4 py-3 text-[13px] leading-6 text-rose-200/80" role="status">评分服务未能完成有效计算，回答已保存；这属于技术问题，不代表作答差或成绩低。</p> : dims.some(dim => dim.status === "insufficient") ? <p className="mt-5 text-[13px] leading-6 text-slate-500">证据不足表示暂时无法作出判断，不按 0 分计算，也不等同于低分。</p> : null}
      <p className="mt-4 text-[12px] leading-6 text-slate-600">总分仅为本情境描述性汇总；不同情境、新旧版本不直接比较，不设招聘淘汰线。</p>
      {report.review_reasons?.length ? <p className="mt-2 text-[12px] leading-6 text-slate-500">复核原因：{report.review_reasons.map(reason => { const [kind, id] = reason.split(":"); const name = dims.find(dim => dim.id === id)?.name ?? "相关维度"; return reviewLabels[kind] ?? `${name}需人工核对`; }).join("；")}</p> : null}
      <Separator className="my-7 bg-white/[.06]" />
      {complete ? <div className="grid items-center gap-10 md:grid-cols-[300px_1fr]">
        <RadarChart dims={dims.map(dim => ({ name: dim.name, score: dim.score ?? 0 }))} />
        <div className="grid gap-2.5">{dims.map((dim, index) => <div key={dim.id} className="flex items-center gap-3">
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: domains[index]?.tone }} />
          <span className="w-[104px] shrink-0 text-[12px] text-slate-400">{dim.name}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full" style={{ width: `${(dim.score ?? 0) / 20 * 100}%`, background: `${domains[index]?.tone}dd` }} /></div>
          <span className="w-11 shrink-0 text-right font-mono text-[12px] text-slate-400">{dim.score ?? "—"}/20</span>
        </div>)}</div>
      </div> : <p className="text-[12px] text-slate-600">存在未评分维度，暂不绘制完整雷达图。</p>}
      {typeof report.sampling_stats?.variance === "number" ? <p className="mt-6 text-[12px] text-slate-700">五次评分总分方差 {Number(report.sampling_stats.variance.toFixed(2))}。重复评分稳定性不代表测量效度。</p> : null}
    </section>

    {weighted ? <section className="mt-6 rounded-2xl border border-sky-100/[.1] bg-[linear-gradient(120deg,#9bb8ca09,transparent)] p-7">
      <h2 className="flex items-center gap-2.5 text-[15px] font-normal text-slate-200"><Scale className="size-4 text-sky-100/60" />按岗位权重的加权结果</h2>
      <p className="mt-2.5 text-[13px] leading-6 text-slate-500">{weighted.note}{weighted.weights.mode === "equal" ? " 本场景未单独设置权重（八维等权）。" : ""}</p>
      <div className="mt-5 grid gap-2">{weighted.contributions.map((item, index) => <div key={item.id} className="flex items-center gap-3">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: domains[index]?.tone }} />
        <span className="w-[104px] shrink-0 text-[12px] text-slate-400">{item.name}</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#b49b80,#a3bcba)]" style={{ width: `${Math.min(100, item.weighted_score / 2.5 * 10)}%` }} /></div>
        <span className="shrink-0 font-mono text-[11px] text-slate-500">{item.score}/20 · 权重{(item.weight * 100).toFixed(1)}% → 贡献 {item.weighted_score.toFixed(1)}</span>
      </div>)}</div>
    </section> : null}

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {dims.map((dim, index) => <section key={dim.id} className="rounded-2xl border border-white/[.07] bg-[#0f1721]/60 p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2.5 text-[14px] font-normal text-slate-200"><span className="size-1.5 rounded-full" style={{ background: domains[index]?.tone }} />{dim.name}</h3>
          <span className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px]", dim.score === null ? "border-white/10 text-slate-500" : "border-sky-100/15 bg-sky-100/[.04] text-sky-100/75")}>{dim.score === null ? dimStatus[dim.status] ?? dim.status : `${dim.score} / 20`}</span>
        </div>
        <p className="mt-3.5 text-[13px] leading-[1.9] text-slate-500">{dim.analysis}</p>
        {dim.slot_results.map(slot => <div key={slot.slot_id} className="mt-4 border-t border-white/[.05] pt-3">
          <p className="text-[11px] text-slate-600">观察点 {slot.slot_id.split(":").at(-1)} · {slot.sufficiency === "sufficient" ? "可判断" : slot.sufficiency === "partial" ? "存在表现缺口" : "未形成证据"}</p>
          {slot.evidence.map((item, i) => <blockquote key={`${item.message_id}-${i}`} className="mt-2.5 rounded-lg border-l-2 border-sky-100/20 bg-white/[.02] px-4 py-3">
            <Quote className="mb-1.5 size-3 text-slate-600" />
            <p className="text-[13px] leading-[1.9] text-slate-300">“{item.quote}”</p>
            <p className="mt-1.5 text-[11px] leading-5 text-slate-600">{item.reason}</p>
            {item.response_context ? <p className="mt-1 text-[11px] leading-5 text-slate-700">结合明确的提问回应判断；此前已完成 {item.response_context.answered_opportunities} 次相关提问与回应。</p> : null}
          </blockquote>)}
          {!slot.evidence.length ? <p className="mt-2 text-[11px] text-slate-700">无可定位原话，保留缺失。</p> : null}
        </div>)}
      </section>)}
    </div>

    <section className="mt-6 rounded-2xl border border-white/[.07] bg-[#0f1721]/60 p-7">
      <h2 className="flex items-center gap-2.5 text-[14px] font-normal text-slate-200"><ShieldAlert className="size-4 text-slate-500" />解释边界</h2>
      <p className="mt-3 text-[13px] leading-7 text-slate-500">{report.final_recommendation}</p>
      {report.suggestions?.length ? <ul className="mt-3 grid gap-1.5">{report.suggestions.map((suggestion, i) => <li key={i} className="flex gap-2.5 text-[13px] leading-6 text-slate-500"><span className="pt-0.5 font-mono text-[10px] text-slate-700">0{i + 1}</span>{suggestion}</li>)}</ul> : null}
    </section>
    {embedded ? null : <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pb-4">
      <Button asChild variant="ghost" className="gap-2.5 text-[12px] font-normal text-slate-500"><Link href="/scenarios"><ArrowLeft className="size-3.5" />返回情境选择</Link></Button>
      <Button asChild variant="outline" className="gap-2.5 border-white/15 bg-white/[.025] text-[12px] font-normal text-slate-300"><Link href={`/chat/${sessionId}`}><RefreshCw className="size-3" />回看本次对话</Link></Button>
    </div>}
  </Shell>;
}

function Shell({ title = "行为观察报告", embedded = false, children }: { title?: string; embedded?: boolean; children: React.ReactNode }) {
  return <div className={cn("mx-auto max-w-[1000px] px-6 pt-7 pb-10 md:px-10", embedded && "px-0 pt-0 md:px-0")}>
    <div className="mb-6 flex items-center gap-3"><FileText className="size-4 text-slate-500" /><h1 className="text-[15px] font-normal text-slate-300">{title}</h1><span className="ml-auto font-mono text-[10px] tracking-[.2em] text-slate-700">OBSERVATION · EVIDENCE</span></div>
    {children}
  </div>;
}

/** 8 轴 SVG 雷达：不引入 Recharts，按光谱配色手绘，量尺 0—20。 */
function RadarChart({ dims }: { dims: Array<{ name: string; score: number }> }) {
  const size = 320, center = size / 2, radius = 108;
  const pointsFor = (value: number) => dims.map((dim, index) => {
    const angle = (Math.PI * 2 * index) / dims.length - Math.PI / 2;
    const r = (value / 20) * radius;
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  }).join(" ");
  const polygon = useMemo(() => pointsFor(20), [dims.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const scorePolygon = pointsForLabel();
  function pointsForLabel() {
    return dims.map((dim, index) => {
      const angle = (Math.PI * 2 * index) / dims.length - Math.PI / 2;
      const r = (dim.score / 20) * radius;
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
    }).join(" ");
  }
  return <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="八维雷达图" className="mx-auto w-full max-w-[300px]">
    {[5, 10, 15, 20].map(level => <polygon key={level} points={pointsForStatic(level)} fill="none" stroke="rgba(155,180,212,.4)" strokeWidth="1" />)}
    <polygon points={polygon} fill="none" stroke="rgba(155,180,212,.6)" strokeWidth="1" />
    {dims.map((dim, index) => {
      const angle = (Math.PI * 2 * index) / dims.length - Math.PI / 2;
      const x = center + Math.cos(angle) * radius, y = center + Math.sin(angle) * radius;
      return <line key={dim.name} x1={center} y1={center} x2={x} y2={y} stroke="rgba(155,180,212,.4)" strokeWidth="1" />;
    })}
    <polygon points={scorePolygon} fill="rgba(84,185,255,.24)" stroke="#85d1ff" strokeWidth="2" />
    {dims.map((dim, index) => {
      const angle = (Math.PI * 2 * index) / dims.length - Math.PI / 2;
      const r = (dim.score / 20) * radius;
      return <circle key={`${dim.name}-dot`} cx={center + Math.cos(angle) * r} cy={center + Math.sin(angle) * r} r="3" fill={domains[index]?.tone ?? "#9bb8c9"} />;
    })}
    {dims.map((dim, index) => {
      const angle = (Math.PI * 2 * index) / dims.length - Math.PI / 2;
      const x = center + Math.cos(angle) * (radius + 22), y = center + Math.sin(angle) * (radius + 22);
      return <text key={`${dim.name}-label`} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#c0d2eb">{dim.name.slice(0, 4)}</text>;
    })}
  </svg>;
  function pointsForStatic(value: number) {
    return dims.map((_, index) => {
      const angle = (Math.PI * 2 * index) / dims.length - Math.PI / 2;
      const r = (value / 20) * radius;
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
    }).join(" ");
  }
}
