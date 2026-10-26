"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Wrench } from "lucide-react";
import { getAdminSessionDetail, recoverTurn, retryScoring } from "@/lib/api";
import type { AdminSessionDetail } from "@/lib/types";
import { AdminHeading } from "./admin-shell";
import { ReportView } from "../report-view";
import { TransitionLink as Link } from "../transition-link";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = { running: "进行中", finished: "已完成", scoring: "评分中", abandoned: "已中断" };
type Tab = "replay" | "report";

/** 记录详情：逐轮对话回放 + 同一报告组件 + 重试评分 / 恢复中断运维操作。 */
export function RecordDetail({ sessionId }: { sessionId: string }) {
  const [detail, setDetail] = useState<AdminSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("replay");
  const [busy, setBusy] = useState(false);
  async function load() { setDetail(await getAdminSessionDetail(sessionId)); }
  useEffect(() => { load().catch(err => setError(err instanceof Error ? err.message : "读取失败")); }, [sessionId]);
  if (error && !detail) return <div className="rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-8 text-center text-[12px] text-rose-200/80" role="alert">{error}</div>;
  if (!detail) return <div className="grid h-[240px] place-items-center text-[11px] text-slate-600" role="status">正在读取记录详情…</div>;
  const { session, messages, report } = detail;
  async function run(action: "scoring" | "turn") {
    setBusy(true); setError(null); setNote(null);
    try {
      const result = action === "scoring" ? await retryScoring(sessionId) : await recoverTurn(sessionId);
      setNote(`操作已提交：${JSON.stringify(result).slice(0, 200)}`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "操作失败"); } finally { setBusy(false); }
  }
  return <div>
    <AdminHeading kicker="STUDIO / RECORD DETAIL" title={session.scenario?.title ?? "会话回放"} description={`${session.user?.nickname ?? "未留名"} · ${session.round} 轮 · ${statusLabels[session.status] ?? session.status} · ${new Date(session.startedAt).toLocaleString("zh-CN")}`} />
    <div className="-mt-3 mb-6 flex flex-wrap items-center gap-3">
      <Button asChild variant="ghost" size="sm" className="gap-2.5 text-[10px] font-normal text-slate-500 hover:bg-white/[.03]"><Link href="/admin/records"><ArrowLeft className="size-3.5" />返回记录列表</Link></Button>
      <span className="ml-auto flex flex-wrap gap-2">
        {session.status === "finished" || session.status === "scoring" ? <Button variant="outline" disabled={busy} onClick={() => void run("scoring")} className="gap-2 border-white/15 bg-white/[.025] text-[10px] font-normal text-slate-300"><RefreshCw className="size-3" />重试评分</Button> : null}
        {session.status === "running" ? <Button variant="outline" disabled={busy} onClick={() => void run("turn")} className="gap-2 border-white/15 bg-white/[.025] text-[10px] font-normal text-slate-300"><Wrench className="size-3" />恢复中断回合</Button> : null}
      </span>
    </div>
    {error ? <p className="mb-4 rounded-lg border border-rose-300/20 bg-rose-300/[.04] px-4 py-3 text-[11px] text-rose-200/85" role="alert">{error}</p> : null}
    {note ? <p className="mb-4 rounded-lg border border-sky-100/15 bg-sky-100/[.04] px-4 py-3 text-[11px] text-sky-100/75" role="status">{note}</p> : null}
    <div className="mb-6 flex gap-2">{([["replay", "对话回放"], ["report", "行为观察报告"]] as Array<[Tab, string]>).map(([key, labelText]) => (
      <button key={key} onClick={() => setTab(key)} className={cn("cursor-pointer rounded-full border px-4 py-2 text-[10.5px] transition-colors", tab === key ? "border-sky-100/40 bg-sky-100/[.06] text-sky-100" : "border-white/10 bg-white/[.02] text-slate-500 hover:text-slate-200")}>{labelText}</button>
    ))}</div>
    {tab === "replay" ? <div className="mx-auto grid max-w-[760px] gap-5">{messages.map(message => (
      <div key={message.id} className={cn("flex gap-3", message.senderType === "user" && "flex-row-reverse")}>
        <span className={cn("mt-1 grid size-8 shrink-0 place-items-center rounded-full border text-[10px]", message.senderType === "user" ? "border-white/10 bg-slate-700/30 text-slate-300" : "border-white/[.08] bg-white/[.025] text-slate-400")}>{message.senderType === "user" ? "你" : message.senderName[0]}</span>
        <div className={cn("max-w-[85%]", message.senderType === "user" && "flex flex-col items-end")}>
          <p className="mb-2 flex items-center gap-2 text-[9px] text-slate-600">{message.senderName}<span className="text-[8px] text-slate-700">第 {message.roundIndex} 轮{message.senderRole ? ` · ${message.senderRole}` : ""}</span></p>
          <div className={cn("whitespace-pre-wrap break-words rounded-2xl border px-4 py-3 text-[11.5px] leading-[1.9]", message.senderType === "user" ? "rounded-tr-[5px] border-sky-100/[.12] bg-[linear-gradient(120deg,#6c8ca51c,#8eaebf0c)] text-slate-200" : "rounded-tl-[5px] border-white/[.075] bg-[#111a24]/70 text-slate-300")}>{message.content}</div>
        </div>
      </div>
    ))}{!messages.length ? <div className="rounded-xl border border-dashed border-white/10 py-12 text-center text-[11px] text-slate-600">该会话还没有对话记录。</div> : null}</div> : <ReportView sessionId={sessionId} embedded />}
  </div>;
}
