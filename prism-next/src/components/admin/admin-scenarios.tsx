"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, Plus, Trash2, Power, Layers3, LockKeyhole, SlidersHorizontal } from "lucide-react";
import { deleteAdminScenario, listAdminScenarios, updateAdminScenario } from "@/lib/api";
import type { Scenario } from "@/lib/types";
import { domains } from "@/lib/content";
import { BUILTIN_CODES } from "@/lib/builtin-map";
import { useMotionPreferences } from "../app-shell";
import { TransitionLink as Link } from "../transition-link";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

const originLabels: Record<string, string> = { builtin: "内置情境", custom: "自定义生成", legacy: "旧版演示" };

/** 场景与岗位配置（正式数据）：启停、删除保护、权重摘要与四步向导入口。 */
export function AdminScenarios() {
  const { enabled } = useMotionPreferences();
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Scenario | null>(null);

  async function load() { setScenarios(await listAdminScenarios()); }
  useEffect(() => { load().catch(err => setError(err instanceof Error ? err.message : "读取失败")); }, []);

  async function toggle(item: Scenario) {
    setBusyId(item.id); setError(null);
    try {
      await updateAdminScenario(item.id, { status: item.status === "active" ? "inactive" : "active" });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "操作失败"); } finally { setBusyId(null); }
  }
  async function remove() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id); setError(null);
    try {
      await deleteAdminScenario(confirmDelete.id);
      setNote(`已删除「${confirmDelete.title}」。`);
      setConfirmDelete(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "删除失败"); } finally { setBusyId(null); }
  }

  if (error && !scenarios) return <div className="rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-8 text-center text-[12px] text-rose-200/80" role="alert">{error}</div>;
  if (!scenarios) return <div className="grid h-[240px] place-items-center text-[11px] text-slate-600" role="status">正在读取情境配置…</div>;

  const visible = scenarios.filter(item => (filter === "all" || (item.origin ?? (item.assessmentVersion ? "builtin" : "legacy")) === filter) && `${item.title}${item.description}`.includes(query.trim()));
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="relative w-full max-w-[310px]"><Search className="absolute top-3 left-3 size-3.5 text-slate-600" /><Input aria-label="搜索情境或岗位" placeholder="搜索情境或岗位" value={query} onChange={event => setQuery(event.target.value)} className="h-10 rounded-lg border-white/10 bg-white/[.025] pl-9 text-[11px] placeholder:text-slate-600" /></div>
      <Button asChild className="h-10 gap-2 rounded-lg bg-slate-200 px-4 text-[11px] font-normal text-slate-950 hover:bg-white"><Link href="/admin/scenarios/new"><Plus className="size-3.5" />新建评估情境</Link></Button>
    </div>
    <div className="mb-5 flex gap-5 border-b border-white/[.065]">{[["all", "全部情境"], ["builtin", "内置情境"], ["custom", "自定义生成"], ["legacy", "旧版演示"]].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={cn("relative cursor-pointer pb-3 text-[10px] transition-colors hover:text-slate-200", filter === value ? "text-sky-100" : "text-slate-600")}>{label}{filter === value && <motion.span layoutId="scenario-filter" className="absolute inset-x-0 bottom-0 h-px bg-sky-100/60" transition={{ duration: enabled ? .25 : 0 }} />}</button>)}</div>
    {(error || note) ? <p role="status" className={cn("mb-4 text-[10px] leading-6", error ? "text-rose-300/80" : "text-sky-100/65")}>{error ?? note}</p> : null}
    <div className="grid gap-4 xl:grid-cols-2"><AnimatePresence initial={false}>{visible.map(item => {
      const kind = item.origin ?? (item.assessmentVersion ? "builtin" : "legacy");
      const weights = item.dimensionWeights?.weights;
      const equal = !weights || Object.values(weights).every(value => Math.abs(value - 0.125) < 0.0001);
      return <motion.div key={item.id} layout={enabled} initial={enabled ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: enabled ? .35 : 0 }}>
        <Card className={cn("relative h-full gap-0 overflow-hidden rounded-xl border-white/[.075] bg-[#0f1721]/70 p-5", item.status !== "active" && "opacity-65")}>
          <div className="flex items-start justify-between gap-3">
            <span className="flex items-center gap-2 text-[9px] text-slate-500"><span className={cn("size-1 rounded-full", kind === "legacy" ? "bg-slate-600" : "bg-sky-100/50")} />{originLabels[kind] ?? kind}<span className="ml-1 font-mono text-slate-600">{BUILTIN_CODES[item.id] ?? (kind === "custom" ? "自定义" : item.id.slice(0, 8))}</span></span>
            <span className="flex items-center gap-1.5">
              <button aria-label={`启用或停用 ${item.title}`} disabled={busyId === item.id} onClick={() => void toggle(item)} title={item.status === "active" ? "停用（候选人端隐藏）" : "启用"} className="cursor-pointer text-slate-500 transition-colors hover:text-slate-200 disabled:opacity-40"><Power className="size-3.5" /></button>
              <button aria-label={`删除 ${item.title}`} disabled={busyId === item.id} onClick={() => setConfirmDelete(item)} title="删除" className="cursor-pointer text-slate-500 transition-colors hover:text-rose-300 disabled:opacity-40"><Trash2 className="size-3.5" /></button>
            </span>
          </div>
          <div className="mt-3 flex gap-5">
            <div className="hidden h-[78px] w-[96px] shrink-0 place-items-center rounded-lg border border-white/[.055] bg-gradient-to-br from-slate-700/20 to-transparent sm:grid"><Layers3 className="size-6 text-slate-500" strokeWidth={1} /></div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-normal leading-6 text-slate-200">{item.title}</h2>
              <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-slate-500">{item.description}</p>
              <p className="mt-1.5 text-[9px] text-slate-600">{kind === "legacy" ? "单独保留的旧版演示" : `统一八维 · 最多 ${item.maxRound} 轮 · ${item.sessionCount ?? 0} 个会话`}</p>
            </div>
          </div>
          <div aria-label="八维相对权重" className="mt-5 flex h-1.5 gap-1 overflow-hidden rounded-full">{domains.map((domain, index) => <div key={domain.name} style={{ width: equal ? "12.5%" : `${(weights ? weights[`GE0${index + 1}` as "GE01"] : 0.125) * 100}%`, background: `${domain.tone}66` }} className="min-w-px rounded-full" />)}</div>
          <div className="mt-5 flex items-center justify-between border-t border-white/[.055] pt-3">
            <span className="flex items-center gap-1.5 text-[9px] text-slate-600">{kind === "builtin" && <LockKeyhole className="size-2.5" />}{kind === "builtin" ? "内容保留 · 可配置权重" : kind === "legacy" ? "与新版测量分开解释" : "可修订与文档回传"}</span>
            <Button asChild variant="ghost" className="-mr-2 h-7 gap-2 px-2 text-[9px] font-normal text-slate-400 hover:bg-white/[.04]"><Link href={`/admin/scenarios/${item.id}`}><SlidersHorizontal className="size-3" />配置 / 详情</Link></Button>
          </div>
        </Card>
      </motion.div>;
    })}</AnimatePresence></div>
    {!visible.length ? <div className="rounded-xl border border-dashed border-white/10 py-16 text-center text-[12px] text-slate-600">没有找到相应情境。</div> : null}
    {confirmDelete ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-6" role="dialog" aria-modal="true" aria-label="删除确认">
      <div className="w-full max-w-[430px] rounded-2xl border border-white/10 bg-[#0e1620] p-7">
        <h3 className="text-[17px] font-normal text-slate-100">删除「{confirmDelete.title}」？</h3>
        <p className="mt-3 text-[11px] leading-7 text-slate-500">{confirmDelete.sessionCount ? `该场景已有 ${confirmDelete.sessionCount} 个测评记录，为保留历史数据不能删除；可改为停用。` : "此操作不可恢复。没有测评记录的场景可以删除。"}</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)} className="text-[11px] font-normal text-slate-500">取消</Button>
          {!confirmDelete.sessionCount ? <Button onClick={() => void remove()} disabled={busyId === confirmDelete.id} className="gap-2 bg-rose-200/90 text-[11px] font-normal text-rose-950 hover:bg-rose-100">确认删除<Trash2 className="size-3" /></Button> : null}
        </div>
      </div>
    </div> : null}
  </>;
}
