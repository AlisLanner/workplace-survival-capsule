"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, ArrowRight, UsersRound, CircleCheck, Timer, Layers3, Plus, SlidersHorizontal } from "lucide-react";
import { getDashboard, listAdminScenarios, listSessions } from "@/lib/api";
import type { AdminSession, DashboardData, Scenario } from "@/lib/types";
import { useMotionPreferences } from "../app-shell";
import { TransitionLink as Link } from "../transition-link";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

const statusLabel: Record<string, string> = { running: "进行中", finished: "已完成", scoring: "评分中", abandoned: "已中断" };

/** 工作台概览（真实统计）：会话计数、情境使用分布与最近测评均来自正式接口。 */
export function AdminOverview() {
  const { enabled } = useMotionPreferences();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([getDashboard(), listAdminScenarios(), listSessions()])
      .then(([board, scenarioList, sessionList]) => { setDashboard(board); setScenarios(scenarioList); setSessions(sessionList); })
      .catch(err => setError(err instanceof Error ? err.message : "统计数据读取失败"));
  }, []);
  if (error) return <div className="rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-8 text-center text-[12px] text-rose-200/80" role="alert">{error}</div>;
  if (!dashboard) return <div className="grid h-[240px] place-items-center text-[11px] text-slate-600" role="status">正在读取正式统计…</div>;
  const stats = [
    { name: "全部测评", value: dashboard.total_sessions, unit: "次", icon: UsersRound },
    { name: "进行中", value: dashboard.running_sessions, unit: "次", icon: Timer },
    { name: "已完成", value: dashboard.completed_sessions, unit: "次", icon: CircleCheck },
    { name: "启用情境", value: scenarios.filter(item => item.status === "active").length, unit: "套", icon: Layers3 },
  ];
  const usage = scenarios.filter(item => item.status === "active").slice(0, 6)
    .map(item => ({ label: item.title, code: item.description.split(" · ")[0] ?? item.id, count: sessions.filter(session => session.scenario?.id === item.id).length, tone: "#9ab8c9" }));
  const maxCount = Math.max(1, ...usage.map(item => item.count));
  return <div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map((stat, index) => <motion.div key={stat.name} initial={enabled ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: .10 + index * .06, duration: .5 }}><Card className="relative gap-0 overflow-hidden rounded-xl border-white/[.075] bg-[linear-gradient(130deg,#c4dbe607,transparent_70%)] p-5"><div className="flex items-center justify-between text-[11px] text-slate-500"><span>{stat.name}</span><stat.icon className="size-4 text-slate-600" strokeWidth={1.3} /></div><p className="mt-5 font-sans text-[34px] font-light leading-none tracking-tight text-slate-100">{String(stat.value).padStart(2, "0")}<span className="ml-2 text-[10px] font-normal text-slate-600">{stat.unit}</span></p><div className="mt-5 h-px w-10 bg-gradient-to-r from-sky-100/25 to-transparent" /></Card></motion.div>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
      <Card className="gap-0 rounded-xl border-white/[.075] bg-[#0e151d]/60 p-5 md:p-6">
        <div className="flex items-center justify-between"><div><h2 className="text-[14px] font-normal text-slate-200">情境使用分布</h2><p className="mt-2 text-[9px] text-slate-600">从不同岗位切面，组织每一次观察。</p></div><span className="text-[9px] text-slate-600">正式数据</span></div>
        <div className="mt-8 grid h-[156px] items-end gap-4 px-2" style={{ gridTemplateColumns: `repeat(${Math.max(usage.length, 1)},minmax(0,1fr))` }}>{usage.map((item, index) => <div key={item.code + item.label} className="flex h-full flex-col items-center justify-end"><span className="mb-3 font-mono text-[11px] text-slate-400">{item.count}</span><motion.div initial={enabled ? { height: 0 } : false} animate={{ height: Math.max(6, item.count / maxCount * 108) }} transition={{ delay: .24 + index * .07, duration: .7 }} style={{ background: `linear-gradient(0deg,${item.tone}44,${item.tone}08)`, borderColor: `${item.tone}35` }} className="w-full max-w-12 rounded-t-[3px] border border-b-0"><div className="h-px w-full" style={{ background: `${item.tone}66` }} /></motion.div><span className="mt-3 line-clamp-1 max-w-full text-[9px] text-slate-500">{item.label}</span></div>)}</div>
        <div className="mt-7 border-t border-white/[.055] pt-4 text-[9px] leading-5 text-slate-600">仅统计本库全部会话；完整非模拟报告的分组统计见下方版本分组。</div>
      </Card>
      <Card className="gap-0 rounded-xl border-white/[.075] bg-[#0e151d]/60 p-5 md:p-6">
        <h2 className="text-[14px] font-normal text-slate-200">从一个岗位开始</h2>
        <p className="mt-3 text-[11px] leading-7 text-slate-500">明确角色、任务和协作关系，<br />让每一套情境都围绕真实工作展开。</p>
        <div className="mt-6 grid gap-2">
          <Button asChild variant="outline" className="h-11 justify-between border-white/10 bg-white/[.025] text-[11px] font-normal text-slate-300 hover:bg-white/[.05]"><Link href="/admin/scenarios/new"><span className="flex items-center gap-3"><Plus className="size-3.5" />新建评估情境（四步生成）</span><ArrowUpRight className="size-3.5" /></Link></Button>
          <Button asChild variant="ghost" className="h-11 justify-between text-[11px] font-normal text-slate-500 hover:bg-white/[.025]"><Link href="/admin/scenarios"><span className="flex items-center gap-3"><SlidersHorizontal className="size-3.5" />调整八维观察权重</span><ArrowRight className="size-3.5" /></Link></Button>
        </div>
        {dashboard.groups?.length ? <div className="mt-5 border-t border-white/[.055] pt-4"><p className="mb-2.5 text-[9px] text-slate-600">版本分组（完整非模拟报告）</p><div className="grid gap-1.5">{dashboard.groups.map(group => <p key={group.scenario_id + group.assessment_version} className="flex items-center justify-between text-[9px] text-slate-500"><span className="truncate">{group.scenario_id} · {group.assessment_version}</span><span className="ml-3 shrink-0 font-mono">{group.count} 份 · 均分 {group.average_score}</span></p>)}</div></div> : null}
      </Card>
    </div>
    <div className="mt-7 flex items-center justify-between"><h2 className="text-[13px] font-normal text-slate-300">最近测评</h2><Link href="/admin/records" className="flex items-center gap-2 text-[10px] text-slate-500 hover:text-slate-200">查看全部<ArrowUpRight className="size-3" /></Link></div>
    <div className="mt-3 divide-y divide-white/[.05] rounded-xl border border-white/[.065] bg-slate-900/15 px-5">{sessions.slice(0, 5).map(record => <Link key={record.id} href={`/admin/records/${record.id}`} className="flex items-center justify-between gap-4 py-4 outline-offset-4 hover:bg-white/[.015]"><div className="flex min-w-0 items-center gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[.07] bg-white/[.02] font-mono text-[9px] text-slate-500">{record.scenario?.title?.[0] ?? "测"}</span><div className="min-w-0"><p className="truncate text-[11px] text-slate-300">{record.scenario?.title ?? "会话"} · {record.user?.nickname ?? "未留名"}</p><p className="mt-1.5 truncate font-mono text-[9px] text-slate-600">{record.id}</p></div></div><span className="hidden shrink-0 text-[10px] text-slate-500 sm:block">{new Date(record.startedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><span className="flex shrink-0 items-center gap-1.5 text-[9px] text-sky-100/60"><span className="size-1 rounded-full bg-sky-100/45" />{statusLabel[record.status] ?? record.status}</span></Link>)}</div>
    {!sessions.length ? <div className="mt-3 rounded-xl border border-dashed border-white/10 py-10 text-center text-[11px] text-slate-600">暂无测评记录。</div> : null}
  </div>;
}
