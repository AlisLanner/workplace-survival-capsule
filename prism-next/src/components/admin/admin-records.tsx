"use client";
import { useEffect, useState } from "react";
import { listSessions } from "@/lib/api";
import type { AdminSession } from "@/lib/types";
import { useMotionPreferences } from "../app-shell";
import { TransitionLink as Link } from "../transition-link";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = { running: "进行中", finished: "已完成", scoring: "评分中", abandoned: "已中断" };
const statusTone: Record<string, string> = { running: "text-sky-100/70 border-sky-100/20 bg-sky-100/[.04]", finished: "text-emerald-100/70 border-emerald-100/15 bg-emerald-100/[.03]", scoring: "text-amber-100/70 border-amber-100/20 bg-amber-100/[.03]", abandoned: "text-slate-500 border-white/10 bg-white/[.02]" };

/** 测评记录（正式数据）：全部真实会话，点击进入回放与报告详情。 */
export function AdminRecords() {
  const { enabled } = useMotionPreferences();
  const [sessions, setSessions] = useState<AdminSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { listSessions().then(setSessions).catch(err => setError(err instanceof Error ? err.message : "读取失败")); }, []);
  if (error) return <div className="rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-8 text-center text-[12px] text-rose-200/80" role="alert">{error}</div>;
  if (!sessions) return <div className="grid h-[240px] place-items-center text-[11px] text-slate-600" role="status">正在读取测评记录…</div>;
  return <div className="rounded-xl border border-white/[.065] bg-slate-900/15">
    <div className="hidden grid-cols-[1.1fr_1.4fr_.7fr_.6fr_.6fr] gap-4 border-b border-white/[.055] px-5 py-3.5 text-[9px] tracking-wider text-slate-600 md:grid"><span>情境 / 受测者</span><span>会话</span><span>轮次</span><span>状态</span><span>开始时间</span></div>
    <div className="divide-y divide-white/[.04]">{sessions.map((session, index) => (
      <Link key={session.id} href={`/admin/records/${session.id}`} className="grid gap-2 px-5 py-4 outline-offset-4 transition-colors hover:bg-white/[.015] md:grid-cols-[1.1fr_1.4fr_.7fr_.6fr_.6fr] md:items-center md:gap-4" style={{ animation: enabled ? `fadein .4s ${Math.min(index * .04, .3)}s both` : undefined }}>
        <span className="min-w-0"><span className="block truncate text-[11.5px] text-slate-200">{session.scenario?.title ?? "会话"}</span><span className="mt-1 block text-[9px] text-slate-600">{session.user?.nickname ?? "未留名"}</span></span>
        <span className="truncate font-mono text-[9px] text-slate-600">{session.id}</span>
        <span className="font-mono text-[10px] text-slate-500">{session.round} 轮{session.totalScore !== null && session.totalScore !== undefined ? ` · ${session.totalScore}分` : ""}</span>
        <span className={cn("w-fit rounded-full border px-2.5 py-1 text-[9px]", statusTone[session.status] ?? statusTone.abandoned)}>{statusLabels[session.status] ?? session.status}</span>
        <span className="text-[10px] text-slate-500">{new Date(session.startedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
      </Link>
    ))}</div>
    {!sessions.length ? <div className="py-16 text-center text-[11px] text-slate-600">暂无测评记录。</div> : null}
    <style>{`@keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
  </div>;
}
