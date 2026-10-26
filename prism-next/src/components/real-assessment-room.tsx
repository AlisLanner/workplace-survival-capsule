"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowUp, ArrowDown, NotebookTabs, ChevronRight, Check, Bookmark, AlertTriangle, FileText, Layers3, Clock3, LoaderCircle } from "lucide-react";
import { getSession, sendMessageStream, type StreamEvents } from "@/lib/api";
import type { Message, SessionDetail } from "@/lib/types";
import { useMotionPreferences } from "./app-shell";
import { useRouteTransition } from "./route-transition";
import { TransitionLink as Link } from "./transition-link";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { cn } from "@/lib/utils";

const schema = z.object({ answer: z.string().trim().min(1, "请先填写你的回应。").max(2000, "回应请控制在2000字以内。") });
const TURN_TIME_LIMIT = 240;
const WARNING_THRESHOLD = 25;
const AUTO_TIMEOUT_MESSAGE = "__ASSESSMENT_TIME_EXPIRED__";
const LEGACY_TIMEOUT_MESSAGES = new Set([AUTO_TIMEOUT_MESSAGE, "（时间到）", "(时间到)", "时间到"]);

const statusLabels: Record<string, string> = {
  finished: "评估已结束", abandoned: "评估已中断", scoring: "正在计分并生成报告", scoring_interrupted: "评分已中断，需联系管理员",
};

interface ChatMessage { id: string; kind: "user" | "agent" | "system"; name: string; role: string; text: string; round: number }

function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages
    .filter(message => message.content.trim() && !LEGACY_TIMEOUT_MESSAGES.has(message.content.trim()))
    .map(message => ({
      id: message.id,
      kind: message.senderType === "user" ? "user" : message.senderType === "system" ? "system" : "agent",
      name: message.senderName,
      role: message.senderRole ?? "",
      text: message.content,
      round: message.roundIndex
    }));
}

/** 正式对话工作区：真实会话 + SSE 流式作答 + 单轮计时 + 中断恢复，视觉沿用棱镜工作台。 */
export function RealAssessmentRoom({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { enabled } = useMotionPreferences();
  const { navigate } = useRouteTransition();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [retryContent, setRetryContent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [judging, setJudging] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; message: string; current?: number; total?: number; delayed?: boolean } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(TURN_TIME_LIMIT);
  const [taskOpen, setTaskOpen] = useState(false);
  const [away, setAway] = useState(false);
  const stream = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const streamBuffer = useRef("");
  const streamContent = useRef("");
  const streamSpeaker = useRef({ name: "对方", role: "" });
  const streamRound = useRef(0);
  const activeStreamId = useRef<string | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { answer: "" } });
  const draft = watch("answer");

  useEffect(() => {
    try { setNickname(localStorage.getItem("maat_nickname") ?? "候选人"); } catch { setNickname("候选人"); }
    getSession(sessionId)
      .then(result => {
        setDetail(result);
        setMessages(toChatMessages(result.messages));
      })
      .catch(err => setError(err instanceof Error ? err.message : "会话读取失败"));
    return () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); };
  }, [sessionId]);

  const round = detail?.session.round ?? 0;
  const maxRound = detail?.scenario.maxRound ?? 15;
  const status = detail?.session.status ?? "running";
  const lastRelevant = messages.at(-1);
  const canResume = !sending && !judging && status === "running" && lastRelevant?.kind === "user" && lastRelevant.round === round;
  const reporting = !error && (judging || status === "scoring" || (canResume && round >= maxRound));
  const isUserTurn = !!detail && !sending && !reporting && !canResume && !error && status === "running";
  const phaseLabel = error ? "处理遇到问题" : !detail ? "正在读取会话" : reporting ? "正在计分并生成报告" : statusLabels[status] ?? (sending ? "正在准备角色回应" : canResume ? "回答已保存，等待处理" : "等待你作答");
  const displayedRound = Math.min(maxRound, sending || reporting || status !== "running" || canResume ? Math.max(round, lastRelevant?.round ?? 0, sending ? streamRound.current : 0) : round + 1);
  const timeWarning = isUserTurn && timeRemaining <= WARNING_THRESHOLD;
  const answered = messages.filter(message => message.kind === "user").length;
  const participants = useMemo(() => {
    const map = new Map<string, string>();
    messages.filter(message => message.kind === "agent").forEach(message => map.set(message.name, message.role));
    return [...map.entries()];
  }, [messages]);
  const activeSpeaker = messages.filter(message => message.kind === "agent").at(-1);

  // 同一浏览器的同一会话、同一轮复用截止时间；后台节流和刷新不重置倒计时。
  useEffect(() => {
    if (!isUserTurn) return;
    const key = `maat:deadline:${sessionId}:${round}`;
    let deadline = Date.now() + TURN_TIME_LIMIT * 1000;
    try {
      const saved = Number(localStorage.getItem(key));
      if (saved > 0 && saved <= deadline) deadline = saved;
      localStorage.setItem(key, String(deadline));
    } catch { /* 存储不可用时仍按本次固定截止时间计时。 */ }
    let submitted = false;
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeRemaining(next);
      if (next <= 0 && !submitted) {
        submitted = true;
        void submit(AUTO_TIMEOUT_MESSAGE, false);
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserTurn, sessionId, round]);

  // 刷新或流断开后只读查询服务端状态，绝不因刷新重复启动收费评分。
  useEffect(() => {
    if (sending || judging || !(status === "scoring" || canResume)) return;
    let cancelled = false, failures = 0;
    const timer = setInterval(async () => {
      try {
        const result = await getSession(sessionId);
        if (cancelled) return;
        failures = 0;
        setDetail(result);
        setMessages(toChatMessages(result.messages));
        if (result.session.status === "finished") router.push(`/report/${sessionId}`);
      } catch {
        if (!cancelled && ++failures >= 3) {
          setError("暂时无法查询处理状态。作答记录已保留，请检查连接后重新读取会话。");
          clearInterval(timer);
        }
      }
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [canResume, sending, judging, sessionId, status, router]);

  useEffect(() => {
    if (pinned.current && stream.current) stream.current.scrollTo({ top: stream.current.scrollHeight, behavior: enabled ? "smooth" : "instant" });
  }, [messages, sending, judging, enabled]);

  const events = useCallback((currentRound: number): StreamEvents => ({
    onSpeaker: (speaker, role) => {
      streamSpeaker.current = { name: speaker, role };
      activeStreamId.current = activeStreamId.current ?? `stream-${Date.now()}`;
    },
    onToken: token => {
      streamBuffer.current += token;
      const chunk = streamBuffer.current;
      if (!activeStreamId.current) return;
      streamContent.current += chunk;
      streamBuffer.current = "";
      const id = activeStreamId.current;
      const text = streamContent.current;
      const speaker = streamSpeaker.current;
      const replyRound = streamRound.current;
      setMessages(items => {
        const existing = items.find(item => item.id === id);
        if (existing) return items.map(item => item.id === id ? { ...item, text } : item);
        return text.trim() ? [...items, { id, kind: "agent", name: speaker.name, role: speaker.role, text, round: replyRound }] : items;
      });
    },
    onJudging: () => {
      setJudging(true);
      setProgress({ percent: 5, message: "对话已结束，正在整理材料。" });
    },
    onReportProgress: value => {
      setJudging(true);
      setProgress({ ...value, percent: Math.max(2, Math.min(100, Math.round(value.percent))), delayed: value.delayed });
    },
    onDone: result => {
      const agentMessage: ChatMessage = { id: `agent-${Date.now()}`, kind: "agent", name: result.reply.speaker, role: result.reply.role, text: result.reply.content, round: result.round };
      const streamId = activeStreamId.current;
      setMessages(items => {
        const rest = items.filter(item => item.id !== streamId);
        if (result.finished) {
          return [...rest, { id: "report-done", kind: "system", name: "评估系统", role: "报告已生成", text: "评分处理已完成，正在打开行为观察报告…", round: result.round }];
        }
        return agentMessage.text.trim() ? [...rest, agentMessage] : rest;
      });
      setDetail(current => current ? { ...current, session: { ...current.session, round: result.round, status: result.finished ? "finished" : ["scoring", "scoring_interrupted", "abandoned"].includes(result.phase ?? "") ? result.phase! : current.session.status } } : current);
      setSending(false);
      setJudging(false);
      setRetryContent(null);
      inFlight.current = false;
      try { localStorage.removeItem(`maat:deadline:${sessionId}:${currentRound}`); } catch { /* ignore */ }
      activeStreamId.current = null;
      streamContent.current = "";
      if (result.finished) {
        setProgress({ percent: 100, message: "行为观察报告已生成。" });
        redirectTimer.current = setTimeout(() => router.push(`/report/${sessionId}`), 1600);
      } else {
        setProgress(null);
      }
    },
    onError: message => {
      const streamId = activeStreamId.current;
      setMessages(items => items.filter(item => item.id !== streamId));
      activeStreamId.current = null;
      streamContent.current = "";
      setError(message);
      inFlight.current = false;
      setSending(false);
      setJudging(false);
      setProgress(null);
    }
  }), [router, sessionId]);

  async function submit(content: string, append: boolean) {
    if (inFlight.current || !detail || judging || (status !== "running")) return;
    inFlight.current = true;
    const currentRound = round;
    const targetRound = append || content === AUTO_TIMEOUT_MESSAGE ? currentRound + 1 : currentRound;
    if (append) {
      setMessages(items => [...items, { id: `user-${Date.now()}`, kind: "user", name: nickname, role: "候选人", text: content, round: targetRound }]);
    }
    reset({ answer: "" });
    setSending(true);
    setError(null);
    setRetryContent(content);
    activeStreamId.current = null;
    streamContent.current = "";
    streamBuffer.current = "";
    streamSpeaker.current = { name: "对方", role: "" };
    streamRound.current = targetRound;
    if (targetRound >= maxRound || content === AUTO_TIMEOUT_MESSAGE) {
      setJudging(true);
      setProgress({ percent: 2, message: "正在提交最后一条作答并整理计分材料，请稍候。" });
    }
    try { await sendMessageStream(sessionId, content, events(currentRound)); }
    catch (err) { events(currentRound).onError(err instanceof Error ? err.message : "连接失败，请重新读取会话状态。"); }
  }

  async function reloadAfterError() {
    try {
      const result = await getSession(sessionId);
      setDetail(result); setMessages(toChatMessages(result.messages)); setError(null);
      if (retryContent && !LEGACY_TIMEOUT_MESSAGES.has(retryContent) && !result.messages.some(message => message.senderType === "user" && message.content === retryContent && message.roundIndex > round)) reset({ answer: retryContent });
      if (result.session.status === "finished") router.push(`/report/${sessionId}`);
    } catch (err) { setError(err instanceof Error ? err.message : "会话读取失败，请稍后重试。"); }
  }

  const enter = (delay: number) => ({ initial: enabled ? { opacity: 0, y: 12 } : false as const, animate: { opacity: 1, y: 0 }, transition: { duration: enabled ? .65 : 0, delay: enabled ? delay : 0 } });
  const scenario = detail?.scenario;

  return <div className="relative mx-auto flex h-[calc(100dvh-106px)] min-h-[560px] max-w-[1440px] flex-col border-x border-white/[.025] bg-[#080d13]/40">
    {timeWarning ? <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_55%,#c98f8f14)]" /> : null}
    <header className="flex min-h-[74px] shrink-0 items-center justify-between gap-4 border-b border-white/[.065] px-5 md:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/scenarios" aria-label="返回情境选择" className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[.07] text-slate-500 transition-colors hover:bg-white/[.04] hover:text-slate-200"><ArrowLeft className="size-3.5" /></Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[14px] font-normal text-slate-200 md:text-[16px]">{scenario?.title ?? "评估会话"}</h1>
            <span className={cn("rounded-full border px-2.5 py-1 text-[11px]", reporting ? "border-sky-200/30 bg-sky-200/[.08] text-sky-100" : "border-white/15 bg-white/[.04] text-slate-300")}>{phaseLabel}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">你的角色：{scenario?.description.split(" · ").at(-1) ?? "受测者"}<span className="mx-2 text-slate-600">/</span>昵称：{nickname}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" onClick={() => { void navigate("/scenarios"); }} aria-label="暂存并退出" title="已提交作答已保存，未发送内容不会提交；计时不会因退出而重置" className="h-9 gap-2 border border-white/15 px-3 text-[12px] font-normal text-slate-300 hover:bg-white/[.06]"><Bookmark className="size-4" /><span className="hidden md:inline">暂存并退出</span></Button>
      </div>
    </header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[244px_minmax(0,1fr)]">
      <motion.aside {...enter(.08)} className="hidden min-h-0 overflow-y-auto border-r border-white/[.065] bg-slate-900/10 px-5 py-6 lg:block">
        <div className="mb-6 rounded-xl border border-white/[.07] bg-[#101924] px-4 py-4">
          <p className="font-mono text-[8px] tracking-[.20em] text-slate-600">YOUR PERSPECTIVE</p>
          <p className="mt-2 text-[13px] text-slate-300">{scenario?.description.split(" · ").at(-1) ?? "受测者"}</p>
        </div>
        <div className="mb-3 flex items-center justify-between"><p className="text-[12px] tracking-wider text-slate-300">当前任务</p><button onClick={() => setTaskOpen(true)} className="flex cursor-pointer items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[.06]">展开说明<ChevronRight className="size-3" /></button></div>
        <p className="line-clamp-8 text-[12px] leading-7 text-slate-400">{scenario?.backgroundForUser}</p>
        <div className="mt-6 border-t border-white/[.055] pt-5">
          <p className="mb-3 text-[12px] tracking-wider text-slate-400">与你互动的角色</p>
          <div className="grid gap-2">
            {participants.length ? participants.map(([name, role], index) => (
              <div key={name} className={cn("relative flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors duration-500", activeSpeaker?.name === name && status === "running" ? "border-white/10 bg-white/[.035]" : "border-transparent")}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/[.08] bg-white/[.025] text-[11px] text-slate-400">{name[0]}</span>
                <div><p className="text-[12px] text-slate-200">{name}</p>{role ? <p className="mt-1 text-[11px] text-slate-400">{role}</p> : null}</div>
                {activeSpeaker?.name === name && status === "running" ? <motion.span layoutId="active-role" className="absolute right-3 size-1 rounded-full bg-sky-100/50" transition={{ duration: enabled ? .4 : 0 }} /> : null}
              </div>
            )) : <p className="text-[10px] leading-6 text-slate-700">开场后角色会在此显示。</p>}
          </div>
        </div>
      </motion.aside>
      <section className="relative flex min-h-0 min-w-0 flex-col">
        <motion.div {...enter(.13)} className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[.08] px-5 py-3 md:px-9">
          <div className="flex items-center gap-2 text-[12px] text-slate-300" role="status">
            {sending || reporting ? <LoaderCircle className={cn("size-4 text-sky-100/80", enabled && "animate-spin")} /> : <span className="size-1.5 rounded-full bg-sky-100/70" />}
            {phaseLabel}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isUserTurn ? <AnswerTimer seconds={timeRemaining} warning={timeWarning} animated={enabled} /> : null}
            <span aria-label={`当前第${displayedRound}轮，最多${maxRound}轮`} className="whitespace-nowrap rounded-lg border border-white/15 bg-white/[.04] px-3 py-2 text-[12px] text-slate-200">第 <strong className="font-mono text-[14px] font-medium">{displayedRound}</strong> / {maxRound} 轮</span>
            <button aria-label="查看任务说明" onClick={() => setTaskOpen(true)} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-2 text-[12px] text-slate-300 hover:bg-white/[.06]"><NotebookTabs className="size-4" /><span className="hidden sm:inline">任务说明</span></button>
          </div>
        </motion.div>
        <div className="h-px shrink-0 bg-white/[.02]"><motion.div animate={{ width: `${Math.min(100, round / maxRound * 100)}%` }} transition={{ duration: enabled ? .6 : 0 }} className="h-px bg-[linear-gradient(90deg,#b49b80,#a3bcba,#9eb2cf,#b49bc0)] opacity-70" /></div>
        <div ref={stream} onScroll={event => { const el = event.currentTarget; const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 110; pinned.current = bottom; setAway(!bottom); }} role="log" aria-label="情境对话" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 [scrollbar-color:#40526844_transparent] [scrollbar-width:thin] md:px-9">
          <div className="mx-auto max-w-[760px]">
            <motion.div {...enter(.2)} className="mb-7 rounded-xl border border-white/[.065] bg-[linear-gradient(110deg,#9bb8ca09,transparent)] px-5 py-4">
              <p className="mb-2 flex items-center gap-2 text-[12px] text-slate-300"><Layers3 className="size-4" />情境就绪 · 说明你的判断及理由</p>
              <p className="line-clamp-4 text-[12px] leading-7 text-slate-400">{scenario?.backgroundForUser}</p>
            </motion.div>
            <AnimatePresence initial={false}>{messages.filter(message => message.text.trim()).map(message => {
              const user = message.kind === "user", system = message.kind === "system";
              return <motion.article key={message.id} layout="position" initial={enabled ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: enabled ? .45 : 0, ease: [.22, .72, .2, 1] }} className={cn("mb-7 flex gap-3", user && "flex-row-reverse")}>
                <span className={cn("mt-1 grid size-8 shrink-0 place-items-center rounded-full border text-[10px]", user ? "border-white/10 bg-slate-700/30 text-slate-300" : system ? "border-sky-100/15 bg-sky-100/[.04] text-sky-100/70" : "border-white/[.08] bg-white/[.025] text-slate-400")}>{system ? <Check className="size-3.5" /> : user ? "你" : message.name[0]}</span>
                <div className={cn("max-w-[87%]", user && "flex flex-col items-end")}>
                  <p className={cn("mb-2.5 flex items-center gap-2 text-[12px] text-slate-300", user && "flex-row-reverse")}>{message.name}<span className="text-[11px] text-slate-400">{user ? `第 ${message.round} 轮${sending && message.id.startsWith("user-") ? "已提交" : "已记录"}` : message.role}</span></p>
                  <div className={cn("whitespace-pre-wrap break-words rounded-2xl border px-4 py-3.5 text-[12px] leading-[2] md:px-5 md:text-[13px]", user ? "rounded-tr-[5px] border-sky-100/[.12] bg-[linear-gradient(120deg,#6c8ca51c,#8eaebf0c)] text-slate-200" : system ? "rounded-[10px] border-sky-100/[.12] bg-[linear-gradient(120deg,#92b6c90b,#bba4c108)] text-slate-300" : "rounded-tl-[5px] border-white/[.075] bg-[#111a24]/70 text-slate-300")}>{message.text}</div>
                </div>
              </motion.article>;
            })}</AnimatePresence>
            {sending && !reporting && !streamContent.current ? <motion.div initial={enabled ? { opacity: 0, y: 5 } : false} animate={{ opacity: 1, y: 0 }} className="mb-7 ml-11 flex w-fit items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-4" role="status" aria-label="正在准备角色回应"><span className="text-[12px] text-slate-300">正在准备角色回应</span><span className="flex gap-1.5">{[0, 1, 2].map(index => <motion.span key={index} className="size-1 rounded-full bg-slate-300" animate={{ opacity: enabled ? [.25, .8, .25] : .5, y: enabled ? [0, -2, 0] : 0 }} transition={{ duration: .9, repeat: enabled ? Infinity : 0, delay: index * .12 }} />)}</span></motion.div> : null}
            {reporting ? <ReportPanel progress={progress} /> : null}
            {status === "finished" ? <motion.div initial={enabled ? { opacity: 0, y: 15 } : false} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-2xl border border-sky-100/[.12] bg-[linear-gradient(120deg,#92b6c90b,#bba4c108)] p-6">
              <span className="mb-4 grid size-9 place-items-center rounded-full border border-sky-100/15 bg-sky-100/[.04] text-sky-100/70"><FileText className="size-4" /></span>
              <h2 className="text-[19px] font-normal text-slate-200">本次测验已完成。</h2>
              <p className="mt-3 text-[11px] leading-7 text-slate-500">你完成了 {answered} 条回应。行为观察报告已生成，原话与评分依据可在报告中核对。</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild className="gap-3 bg-slate-200 text-[10px] font-normal text-slate-950 hover:bg-white"><Link href={`/report/${sessionId}`}>查看行为观察报告<ChevronRight className="size-3" /></Link></Button>
                <Button asChild variant="ghost" className="text-[10px] font-normal text-slate-500"><Link href="/scenarios">返回情境选择</Link></Button>
              </div>
            </motion.div> : null}
            {status === "abandoned" ? <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.02] p-6" role="status">
              <h2 className="flex items-center gap-2 text-[15px] font-normal text-slate-200"><AlertTriangle className="size-4 text-slate-500" />本次评估因长时间未作答已中断</h2>
              <p className="mt-3 text-[11px] leading-7 text-slate-500">对话记录已保留；中断的会话不再继续计分。如需重新评估，请返回情境选择重新开始。</p>
              <div className="mt-4"><Button asChild variant="outline" className="border-white/15 bg-white/[.025] text-[10px] font-normal text-slate-300"><Link href="/scenarios">返回情境选择</Link></Button></div>
            </div> : null}
          </div>
        </div>
        {away ? <Button aria-label="回到最新消息" onClick={() => { pinned.current = true; stream.current?.scrollTo({ top: stream.current.scrollHeight, behavior: enabled ? "smooth" : "instant" }); }} variant="outline" className="absolute right-6 bottom-[205px] z-10 size-8 rounded-full border-white/15 bg-[#141f2b] p-0 text-slate-300"><ArrowDown className="size-3.5" /></Button> : null}
        <motion.div {...enter(.28)} className="shrink-0 px-4 pt-2 pb-4 md:px-8">
          {canResume && !error ? <div className="mx-auto max-w-[790px] rounded-xl border border-sky-100/[.12] bg-white/[.02] px-5 py-4" role="status">
            <p className="text-[12px] text-slate-300">上一条回答已保存，正在查询处理状态。若处理已中断，可继续处理，无需重新作答。</p>
            <Button variant="outline" onClick={() => { void submit(lastRelevant!.text, false); }} className="mt-3 gap-2 border-white/15 bg-white/[.02] text-[10px] font-normal text-slate-300">继续处理上一条回答</Button>
          </div> : null}
          {error ? <div className="mx-auto max-w-[790px] rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-4" role="alert">
            <p className="text-[11px] leading-6 text-rose-200/85">{error}</p>
            <Button variant="outline" onClick={() => { void reloadAfterError(); }} className="mt-3 border-rose-300/25 bg-transparent text-[12px] font-normal text-rose-200/90">重新读取会话状态</Button>
          </div> : null}
          {isUserTurn ? <form onSubmit={handleSubmit(data => void submit(data.answer, true))} noValidate className={cn("relative mx-auto max-w-[790px] overflow-hidden rounded-2xl border bg-[#0d151e]/95 transition-colors focus-within:border-sky-100/25", timeWarning ? "border-rose-300/30" : "border-white/[.12]")}>
            <div aria-hidden="true" className="pointer-events-none absolute top-0 inset-x-12 h-px bg-[linear-gradient(90deg,transparent,#b8a68f55,#a8bebc66,#a7a3c255,transparent)]" />
            <Textarea {...register("answer")} aria-label="输入你的回应" maxLength={2000} rows={3} placeholder={timeWarning ? `本轮剩余 ${timeRemaining} 秒，请尽快作答……` : "写下你的回应……"} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSubmit(data => void submit(data.answer, true))(); } }} className="min-h-[84px] resize-none rounded-none border-0 bg-transparent px-5 pt-4 pb-2 text-[12px] leading-7 text-slate-200 placeholder:text-slate-600 shadow-none focus-visible:ring-0 md:text-[13px]" />
            <div className="flex min-h-11 items-center justify-between gap-3 px-5 pb-3">
              <p className="text-[11px] text-slate-400"><span className="hidden sm:inline">Enter 发送 · Shift + Enter 换行</span><span className={cn("ml-2", timeWarning && "text-rose-200")}>{timeWarning ? "即将到时，请尽快提交" : "每轮限时 4 分钟"}</span></p>
              <div className="flex items-center gap-3"><span className="font-mono text-[11px] text-slate-400">{draft.length} / 2000</span><Button type="submit" aria-label="发送回应" disabled={!draft.trim()} className="h-9 gap-1.5 rounded-full bg-slate-200 px-3 text-[12px] text-slate-950 hover:bg-white disabled:bg-slate-700/40 disabled:text-slate-500 disabled:opacity-100">发送<ArrowUp className="size-4" strokeWidth={1.5} /></Button></div>
            </div>
            {errors.answer ? <p role="alert" className="px-5 pb-3 text-[12px] text-rose-200">{errors.answer.message}</p> : null}
          </form> : reporting ? <div className="mx-auto flex max-w-[790px] items-center justify-center gap-2 rounded-xl border border-sky-200/20 bg-sky-100/[.04] px-5 py-4 text-[13px] text-sky-100"><FileText className="size-4" />作答已结束，正在计分并生成报告，无需继续回复。</div> : null}
          <p className="mt-2 text-center text-[11px] tracking-wide text-slate-400">已提交作答实时保存 · 原话将作为评分证据</p>
        </motion.div>
      </section>
    </div>
    <Dialog open={taskOpen} onOpenChange={setTaskOpen}><DialogContent className="w-[calc(100%-32px)] max-w-[600px] rounded-2xl border-white/10 bg-[#0e1620] p-7">
      <DialogHeader><DialogTitle className="text-[23px] font-normal">{scenario?.title ?? "任务说明"}</DialogTitle><DialogDescription className="pt-2 text-[11px] leading-6">你的角色 · {scenario?.description.split(" · ").at(-1) ?? "受测者"}</DialogDescription></DialogHeader>
      <p className="max-h-[50dvh] overflow-y-auto text-[13px] leading-8 text-slate-400">{scenario?.backgroundForUser}</p>
      {participants.length ? <div className="mt-2 flex flex-wrap gap-2">{participants.map(([name, role]) => <span key={name} className="rounded-lg border border-white/[.07] px-3 py-2 text-[10px] text-slate-500">{name}{role ? ` · ${role}` : ""}</span>)}</div> : null}
    </DialogContent></Dialog>
  </div>;
}

function AnswerTimer({ seconds, warning, animated }: { seconds: number; warning: boolean; animated: boolean }) {
  return <div role="timer" aria-label={`本轮作答剩余${Math.floor(seconds / 60)}分${seconds % 60}秒`} aria-live="off" className={cn("relative flex items-center gap-2 overflow-hidden rounded-lg border px-3 py-2", warning ? "border-rose-200/45 bg-rose-300/[.10] text-rose-100" : "border-sky-200/25 bg-sky-200/[.06] text-sky-100")}>
    <Clock3 className={cn("size-4", warning && animated && "animate-pulse")} />
    <span className="text-[11px]">本轮剩余</span><strong className="font-mono text-[17px] leading-5 font-medium tabular-nums">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</strong>
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-white/[.05]"><div className={cn("h-full transition-[width] duration-300", warning ? "bg-rose-200" : "bg-sky-200/75")} style={{ width: `${seconds / TURN_TIME_LIMIT * 100}%` }} /></div>
  </div>;
}

function ReportPanel({ progress }: { progress: { percent: number; message: string; current?: number; total?: number; delayed?: boolean } | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const timer = setInterval(() => setElapsed(value => value + 1), 1000); return () => clearInterval(timer); }, []);
  const percent = progress?.percent ?? 5;
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7 rounded-2xl border border-white/[.075] bg-[linear-gradient(120deg,#9bb8ca0a,transparent)] p-6" role="status" aria-live="polite">
    <h2 className="flex items-center gap-2 text-[18px] font-medium text-sky-100"><FileText className="size-5" />对话已结束，正在计分并生成报告</h2>
    <div className="mt-3 flex items-center justify-between gap-4"><p className="text-[13px] text-slate-300">{progress?.message ?? "正在核对作答与评分依据，请稍候。"}</p><span className="font-mono text-[13px] text-sky-100/80">{percent}%</span></div>
    <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[.06]" role="progressbar" aria-label="报告生成进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><motion.div animate={{ width: `${percent}%` }} transition={{ duration: .5 }} className="h-full rounded-full bg-[linear-gradient(90deg,#b49b80,#a3bcba,#9eb2cf,#b49bc0)]" /></div>
    <p className="mt-3 text-[12px] leading-6 text-slate-400">{progress?.total ? `已完成 ${progress.current ?? 0}/${progress.total} 组评分核验 · ` : ""}{progress?.delayed ? "当前阶段耗时较长，完成后会继续更新" : `已等待 ${Math.floor(elapsed / 60)} 分 ${elapsed % 60} 秒`}。无需继续作答，报告保存后将自动打开。</p>
  </motion.div>;
}
