"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Users, Target } from "lucide-react";
import { listScenarios, startAssessment } from "@/lib/api";
import { resolveScenarioKey, toSceneEntries, type SceneEntry } from "@/lib/scene-profiles";
import { ScenarioCover } from "./scenario-cover";
import { TransitionLink as Link } from "./transition-link";
import { useRouteTransition } from "./route-transition";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Input } from "./ui/input";

const NICKNAME_KEY = "maat_nickname";

/** 情境介绍（真实数据）：理解处境后由用户显式开始，POST 创建会话并进入 /chat/:sessionId。 */
export function ScenarioIntro({ scenarioKey }: { scenarioKey: string }) {
  const router = useRouter();
  const { registerDestination } = useRouteTransition();
  const [entry, setEntry] = useState<SceneEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    try { setNickname(localStorage.getItem(NICKNAME_KEY) ?? ""); } catch { /* ignore */ }
    listScenarios()
      .then(scenarios => {
        const target = resolveScenarioKey(scenarioKey);
        const found = toSceneEntries(scenarios).find(item => item.key === scenarioKey || (target.id && item.scenario.id === target.id));
        if (!found) { setError("未找到该情境，可能已被停用或删除。"); return; }
        setEntry(found);
      })
      .catch(err => setError(err instanceof Error ? err.message : "情境读取失败"));
  }, [scenarioKey]);

  // 封面随数据挂载；若此刻仍有待落地的飞牌（异步页面晚于路由提交），登记落点完成飞行动画。
  useEffect(() => { if (entry) registerDestination(entry.key); }, [entry, registerDestination]);

  const people = useMemo(() => {
    if (!entry) return [] as string[];
    const fromProfile = entry.scene.people ?? [];
    if (fromProfile.length) return fromProfile;
    // 自定义情境：从任务卡文本中无从提取角色列表时不臆造，仅显示任务。
    return [];
  }, [entry]);

  async function start() {
    if (!entry) return;
    const trimmed = nickname.trim();
    if (!trimmed) { setNicknameError(true); return; }
    setNicknameError(false);
    setStarting(true);
    try {
      localStorage.setItem(NICKNAME_KEY, trimmed);
      const result = await startAssessment({ scenario_id: entry.scenario.id, nickname: trimmed });
      router.push(`/chat/${result.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "会话创建失败");
      setStarting(false);
    }
  }

  if (error) return <div className="mx-auto max-w-[900px] px-6 pt-10"><div className="rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-10 text-center text-[12px] text-rose-200/80" role="alert">{error}</div><div className="mt-6 text-center"><Button asChild variant="outline" className="border-white/15 bg-white/[.025] text-[11px] font-normal"><Link href="/scenarios">返回情境选择</Link></Button></div></div>;
  if (!entry) return <div className="grid h-[320px] place-items-center text-[11px] text-slate-600" role="status">正在读取情境信息…</div>;

  const isCustom = entry.key.length > 2;

  return <div className="mx-auto max-w-[1190px] px-6 pt-7 pb-10 md:px-10 lg:px-14">
    <Button asChild variant="ghost" size="sm" className="-ml-3 mb-7 gap-2.5 text-[10px] font-normal text-slate-500 hover:bg-white/[.03]"><Link href="/scenarios"><ArrowLeft className="size-3.5"/>重新选择情境</Link></Button>
    <div className="grid items-center gap-9 md:grid-cols-[.85fr_1.15fr] lg:gap-20">
      <div className="mx-auto w-full max-w-[350px]"><ScenarioCover scene={entry.scene}/></div>
      <div className="max-w-[530px]">
        <div className="flex items-center justify-between gap-4"><p className="font-mono text-[9px] tracking-[.24em] text-slate-500">THE SITUATION / {isCustom ? "自定义" : entry.key}</p><Badge variant="outline" className="border-white/10 bg-white/[.02] px-2.5 py-1 text-[9px] font-normal text-slate-400">{isCustom ? "自定义情境" : "情境任务"}</Badge></div>
        <h2 className="mt-6 text-[27px] font-normal leading-snug tracking-tight text-slate-100">先理解处境，再作出判断。</h2>
        <div className="mt-6 flex items-center gap-3 text-[12px] text-slate-300"><Target className="size-4 text-slate-500" strokeWidth={1.3}/><span>你的角色</span><span className="ml-1 text-slate-100">{entry.scene.role || entry.scenario.description.split(" · ").at(-1) || "受测者"}</span></div>
        <p className="mt-6 text-[13px] leading-[2.2] text-slate-400">{entry.scenario.backgroundForUser || entry.scene.copy}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-[9px] text-slate-600">
          <span className="rounded-full border border-white/[.07] px-2.5 py-1">最多 {entry.scenario.maxRound} 轮对话</span>
          <span className="rounded-full border border-white/[.07] px-2.5 py-1">统一八维观察</span>
          {entry.scenario.weightsCustomized ? <span className="rounded-full border border-sky-100/15 px-2.5 py-1 text-sky-100/70">已按岗位设置维度权重</span> : null}
        </div>
        <Separator className="my-6 bg-white/[.07]"/>
        {people.length > 0 ? <>
          <div className="flex items-center gap-2.5 text-[10px] text-slate-500"><Users className="size-3.5" strokeWidth={1.3}/>你将面对的角色</div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">{people.map((person,index)=><li key={person} className="flex gap-2.5 text-[10px] leading-6 text-slate-400"><span className="pt-0.5 font-mono text-[8px] text-slate-600">0{index+1}</span><span>{person}</span></li>)}</ul>
        </> : null}
        <div className="mt-8 rounded-xl border border-white/[.09] bg-white/[.02] p-4">
          <label htmlFor="start-nickname" className="text-[10px] text-slate-500">你的昵称 <b className="text-slate-300">*</b><span className="ml-2 text-slate-700">用于区分测评记录</span></label>
          <Input id="start-nickname" value={nickname} maxLength={16} placeholder="请填写昵称后开始" onChange={event => { setNickname(event.target.value); if (nicknameError && event.target.value.trim()) setNicknameError(false); }} className={`mt-2.5 h-10 border-white/10 bg-white/[.025] text-[12px] placeholder:text-slate-700 ${nicknameError ? "border-rose-300/50" : ""}`} aria-invalid={nicknameError} />
          {nicknameError ? <p className="mt-2 text-[10px] text-rose-300/80" role="alert">请先填写昵称再开始评估。</p> : null}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button onClick={() => void start()} disabled={starting} className="gap-6 bg-slate-200 text-[11px] font-normal text-slate-950 hover:bg-white disabled:opacity-70">{starting ? "正在创建会话…" : "进入情境测验"}<ArrowUpRight className="size-3.5"/></Button>
          <Button asChild variant="outline" className="gap-8 border-white/15 bg-white/[.025] text-[11px] font-normal hover:bg-white/[.06]"><Link href="/framework">查看观察框架<ArrowUpRight className="size-3.5"/></Link></Button>
          <Button asChild variant="ghost" className="text-[10px] font-normal text-slate-500"><Link href="/process">了解评估流程</Link></Button>
        </div>
        <p className="mt-4 text-[9px] leading-6 text-slate-700">点击“进入情境测验”才会创建正式会话；刷新或返回本页不会重复创建。</p>
      </div>
    </div>
  </div>;
}
