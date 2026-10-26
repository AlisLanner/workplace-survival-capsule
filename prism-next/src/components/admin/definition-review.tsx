"use client";
import { domains } from "@/lib/content";
import type { DimensionWeights, ScenarioDefinition } from "@/lib/types";

const agentLabels: Record<string, string> = { leader: "上级", coworker: "同级协作方", client: "利益相关方" };

/** 生成结果 / 场景详情的完整审阅视图：事实、角色、事件、16观察点与八维权重。 */
export function DefinitionReview({ definition, weights, warnings }: { definition: ScenarioDefinition; weights: DimensionWeights; warnings?: string[] }) {
  const dimName = (id: string) => domains.find(domain => `GE0${domains.indexOf(domain) + 1}` === id)?.name ?? id;
  return <div className="grid gap-5">
    {warnings?.length ? <div className="rounded-xl border border-amber-200/20 bg-amber-200/[.04] px-4 py-3 text-[10px] leading-6 text-amber-100/80" role="status">{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div> : null}
    <section className="rounded-xl border border-white/[.075] bg-[#0f1721]/70 p-5">
      <h3 className="mb-3 text-[13px] font-normal text-slate-200">① 基本信息</h3>
      <p className="text-[11px] leading-7 text-slate-400">场景标题：<span className="text-slate-200">{definition.title}</span>　·　受测者角色：<span className="text-slate-200">{definition.user_role}</span></p>
      <p className="mt-1.5 text-[9px] text-slate-600">对话 {definition.round_policy.min}—{definition.round_policy.max} 轮 · 测量版本 {definition.assessment_version}</p>
    </section>
    <section className="rounded-xl border border-white/[.075] bg-[#0f1721]/70 p-5">
      <h3 className="mb-3 text-[13px] font-normal text-slate-200">② 三名对话角色</h3>
      <div className="grid gap-2 sm:grid-cols-3">{Object.entries(definition.roles).map(([agent, role]) => (
        <div key={agent} className="rounded-lg border border-white/[.06] px-3.5 py-3"><p className="text-[11px] text-slate-200">{role.name}</p><p className="mt-1 text-[9px] leading-5 text-slate-600">{agentLabels[agent] ?? agent} · {role.role}</p></div>
      ))}</div>
    </section>
    <section className="rounded-xl border border-white/[.075] bg-[#0f1721]/70 p-5">
      <h3 className="mb-3 text-[13px] font-normal text-slate-200">③ 公开事实（候选人可见）</h3>
      <ul className="grid gap-2">{definition.public_facts.map(fact => <li key={fact.id} className="flex gap-2.5 text-[11px] leading-6 text-slate-400"><span className="pt-0.5 font-mono text-[8px] text-slate-600">{fact.id}</span>{fact.text}</li>)}</ul>
    </section>
    <section className="rounded-xl border border-white/[.075] bg-[#0f1721]/70 p-5">
      <h3 className="mb-3 text-[13px] font-normal text-slate-200">④ 角色私有事实与中途事件</h3>
      <ul className="grid gap-2">{Object.entries(definition.role_facts).flatMap(([agent, facts]) => facts.map(fact => <li key={fact.id} className="flex gap-2.5 text-[11px] leading-6 text-slate-400"><span className="pt-0.5 font-mono text-[8px] text-slate-600">{fact.id}</span><span className="text-slate-500">[{agentLabels[agent] ?? agent}]</span>{fact.text}</li>))}
        {definition.events.map(event => <li key={event.id} className="flex gap-2.5 text-[11px] leading-6 text-slate-400"><span className="pt-0.5 font-mono text-[8px] text-slate-600">{event.id}</span><span className="text-sky-100/60">第{event.round}轮 · {agentLabels[event.agent] ?? event.agent}</span>{event.facts[0]?.text}</li>)}</ul>
    </section>
    <section className="rounded-xl border border-white/[.075] bg-[#0f1721]/70 p-5">
      <h3 className="mb-3 text-[13px] font-normal text-slate-200">⑤ 十六个观察点</h3>
      <div className="grid gap-2.5">{definition.slots.map(slot => (
        <div key={slot.slot_id} className="rounded-lg border border-white/[.05] bg-white/[.012] px-4 py-3">
          <p className="flex items-center gap-2.5 text-[11px] leading-6 text-slate-300"><span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[8px] text-slate-500">{slot.display_code}</span>{dimName(slot.dimension_id)}<span className="text-[8px] text-slate-600">向{agentLabels[slot.target_agent] ?? slot.target_agent}取证</span></p>
          <p className="mt-1.5 text-[11px] leading-6 text-slate-400">{slot.observation}</p>
          <p className="mt-1 text-[9px] leading-5 text-slate-600">中性追问：{slot.probe_intent}</p>
        </div>
      ))}</div>
    </section>
    <section className="rounded-xl border border-white/[.075] bg-[#0f1721]/70 p-5">
      <h3 className="mb-3 text-[13px] font-normal text-slate-200">⑥ 八维权重</h3>
      <ul className="grid gap-2">{domains.map((domain, index) => {
        const id = `GE0${index + 1}` as "GE01";
        const weight = weights.weights?.[id] ?? 0.125;
        const importance = weights.importance?.[id];
        const freeText = weights.free_text?.[id];
        return <li key={domain.name} className="flex items-center gap-3 text-[10.5px] text-slate-400">
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: domain.tone }} />
          <span className="w-[92px] shrink-0">{domain.name}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, weight * 500)}%`, background: `${domain.tone}99` }} /></div>
          <span className="w-14 shrink-0 text-right font-mono text-[9px]">{(weight * 100).toFixed(1)}%</span>
          <span className="hidden w-16 shrink-0 text-right text-[9px] text-slate-600 sm:block">{importance ? `${importance}/5` : "未评级"}</span>
          {freeText ? <span className="hidden max-w-[160px] shrink-0 truncate text-[9px] text-slate-600 md:block" title={freeText}>“{freeText}”</span> : null}
        </li>;
      })}</ul>
      {weights.note ? <p className="mt-3 text-[9px] leading-5 text-slate-600">{weights.note}</p> : null}
    </section>
  </div>;
}
