"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Sparkles, Download, FileText } from "lucide-react";
import { domains } from "@/lib/content";
import { exportScenarioDocument, generateScenario, reviseScenario } from "@/lib/api";
import type { GenerateScenarioResponse } from "@/lib/types";
import { AdminHeading } from "./admin-shell";
import { WeightsInput, buildWeightsPayload, emptyWeightsDraft, previewWeights, type WeightsDraft } from "./weights-input";
import { DefinitionReview } from "./definition-review";
import { useMotionPreferences } from "../app-shell";
import { TransitionLink as Link } from "../transition-link";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";

const steps = ["岗位信息", "情境内容", "考察重点与权重", "生成与检查"] as const;
const label = "block text-[11px] text-slate-400";
const field = "mt-2 border-white/10 bg-white/[.025] text-[12px] placeholder:text-slate-700 focus:border-sky-100/30";

/** 四步情境生成向导（正式生成接口）：岗位信息 → 情境内容 → 考察重点与权重 → 生成与检查/迭代。 */
export function ScenarioWizard() {
  const router = useRouter();
  const { enabled } = useMotionPreferences();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ title: "", industry: "", user_role: "", scenario_desc: "", job_requirements: "", extra_notes: "", max_round: 12, leaderName: "", leaderHint: "", coworkerName: "", coworkerHint: "", clientName: "", clientHint: "" });
  const [focus, setFocus] = useState<string[]>([]);
  const [weightsDraft, setWeightsDraft] = useState<WeightsDraft>(emptyWeightsDraft(null));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateScenarioResponse | null>(null);
  const [feedback, setFeedback] = useState("");
  const [revising, setRevising] = useState(false);

  function update(patch: Partial<typeof form>) { setForm(previous => ({ ...previous, ...patch })); }
  function validate(): string | null {
    if (step === 0) {
      if (form.title.trim().length < 2) return "请填写场景标题（至少2个字）";
      if (form.user_role.trim().length < 2) return "请填写受测者角色/岗位";
    }
    if (step === 1 && form.scenario_desc.trim().length < 10) return "请描述情境内容（至少10个字）";
    if (step === 2 && weightsDraft.mode === "numeric" && previewWeights(weightsDraft).invalid) return previewWeights(weightsDraft).invalid!;
    return null;
  }
  function next() { const problem = validate(); if (problem) { setError(problem); return; } setError(null); setStep(value => Math.min(value + 1, 3)); }

  function brief() {
    const hasLeader = form.leaderName.trim() || form.leaderHint.trim(), hasCoworker = form.coworkerName.trim() || form.coworkerHint.trim(), hasClient = form.clientName.trim() || form.clientHint.trim();
    return {
      title: form.title.trim(), industry: form.industry.trim() || undefined, user_role: form.user_role.trim(),
      scenario_desc: form.scenario_desc.trim(), job_requirements: form.job_requirements.trim() || undefined,
      focus_dimensions: focus, extra_notes: form.extra_notes.trim() || undefined, max_round: form.max_round,
      roles: {
        leader: hasLeader ? { name: form.leaderName.trim() || undefined, hint: form.leaderHint.trim() || undefined } : undefined,
        coworker: hasCoworker ? { name: form.coworkerName.trim() || undefined, hint: form.coworkerHint.trim() || undefined } : undefined,
        client: hasClient ? { name: form.clientName.trim() || undefined, hint: form.clientHint.trim() || undefined } : undefined,
      },
      weights_input: buildWeightsPayload(weightsDraft),
    };
  }

  async function generate() {
    const problem = validate(); if (problem) { setError(problem); return; }
    setError(null); setGenerating(true); setNote("正在生成情境（真实模型约需 1—3 分钟，请勿关闭页面）…");
    try {
      const response = await generateScenario(brief());
      setResult(response); setStep(3);
      setNote(response.generated_by === "model" ? `已由大模型生成并安装（${response.attempts} 次尝试）。请检查下方内容。` : "当前为离线模式：已按模板生成可用情境，连接真实模型后可在详情页修订获得定制内容。");
    } catch (err) { setError(err instanceof Error ? err.message : "生成失败，请稍后重试"); } finally { setGenerating(false); }
  }

  async function applyFeedback() {
    if (!result || !feedback.trim()) return;
    setRevising(true); setError(null);
    try {
      const revised = await reviseScenario(result.scenario.id, { instruction: feedback.trim() });
      setResult({ ...result, scenario: revised.scenario, definition: revised.definition, weights: revised.weights, generated_by: revised.generated_by === "document" ? result.generated_by : revised.generated_by });
      setFeedback(""); setNote("已按你的修改意见重新生成，请再次检查。");
    } catch (err) { setError(err instanceof Error ? err.message : "修订失败"); } finally { setRevising(false); }
  }

  async function downloadDoc() {
    if (!result) return;
    try {
      const doc = await exportScenarioDocument(result.scenario.id);
      const blob = new Blob([doc.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = doc.filename; anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : "文档导出失败"); }
  }

  return <div>
    <AdminHeading kicker="STUDIO / SCENARIO BUILDER" title="从岗位，生成一段情境。" description="填写岗位与情境信息，系统按统一八维契约生成完整情境并安装；生成后可写修改意见迭代或下载文档审阅。" />
    <Button asChild variant="ghost" size="sm" className="-mt-3 mb-6 gap-2.5 text-[10px] font-normal text-slate-500 hover:bg-white/[.03]"><Link href="/admin/scenarios"><ArrowLeft className="size-3.5" />返回场景列表</Link></Button>
    <div className="mb-7 flex flex-wrap items-center gap-3">{steps.map((name, index) => <div key={name} className={cn("flex items-center gap-2 text-[10px]", index === step ? "text-sky-100" : "text-slate-600")}><span className={cn("grid size-5 place-items-center rounded-full border font-mono text-[8px]", index <= step ? "border-sky-100/25 bg-sky-100/[.05]" : "border-white/10")}>{index < step ? <Check className="size-2.5" /> : index + 1}</span>{name}{index < 3 && <span className="ml-1 h-px w-5 bg-white/10" />}</div>)}</div>
    {error ? <p className="mb-4 rounded-lg border border-rose-300/20 bg-rose-300/[.04] px-4 py-3 text-[11px] text-rose-200/85" role="alert">{error}</p> : null}
    {note ? <p className="mb-4 rounded-lg border border-sky-100/15 bg-sky-100/[.04] px-4 py-3 text-[11px] text-sky-100/75" role="status">{note}</p> : null}

    {step === 0 ? <motion.div initial={enabled ? { opacity: 0, x: 10 } : false} animate={{ opacity: 1, x: 0 }} className="grid max-w-[720px] gap-5">
      <label className={label}>场景标题 *<Input value={form.title} maxLength={40} placeholder="例如：门店开业冲刺" onChange={event => update({ title: event.target.value })} className={field} /></label>
      <label className={label}>受测者角色 *（候选人扮演的岗位）<Input value={form.user_role} maxLength={40} placeholder="例如：门店店长、项目经理" onChange={event => update({ user_role: event.target.value })} className={field} /></label>
      <label className={label}>行业 / 公司背景（选填）<Input value={form.industry} maxLength={100} placeholder="例如：连锁餐饮、跨境电商" onChange={event => update({ industry: event.target.value })} className={field} /></label>
      <label className={label}>岗位要求（选填）<Textarea rows={3} value={form.job_requirements} placeholder="例如：能扛压、会排班、能协调总部和临时工" onChange={event => update({ job_requirements: event.target.value })} className={field} /></label>
      <label className={label}>对话轮次上限
        <select value={form.max_round} onChange={event => update({ max_round: Number(event.target.value) })} className={cn(field, "h-10 rounded-lg px-3")}>
          {[10, 12, 15].map(rounds => <option key={rounds} value={rounds}>{rounds} 轮（约 {rounds} 次来回对话）</option>)}
        </select>
      </label>
    </motion.div> : null}

    {step === 1 ? <motion.div initial={enabled ? { opacity: 0, x: 10 } : false} animate={{ opacity: 1, x: 0 }} className="grid max-w-[780px] gap-5">
      <label className={label}>情境描述 *（说清楚：什么时间、要完成什么任务、遇到什么矛盾或压力）<Textarea rows={6} value={form.scenario_desc} placeholder="例如：新店开业前三天，人手比计划少三分之一，总部要求开业不能推迟，还要守住首店口碑。" onChange={event => update({ scenario_desc: event.target.value })} className={field} /></label>
      <div className="grid gap-4 sm:grid-cols-3">{([["leader", "上级", "leaderName", "leaderHint"], ["coworker", "同级协作方", "coworkerName", "coworkerHint"], ["client", "利益相关方", "clientName", "clientHint"]] as const).map(([agent, labelText, nameKey, hintKey]) => (
        <div key={agent} className="grid gap-2 rounded-xl border border-dashed border-white/10 p-4">
          <p className="text-[11px] text-slate-300">{labelText}</p>
          <Input value={form[nameKey]} maxLength={12} placeholder="名字（选填）" onChange={event => update({ [nameKey]: event.target.value } as never)} className={field} />
          <Input value={form[hintKey]} maxLength={60} placeholder="身份/关注点（选填）" onChange={event => update({ [hintKey]: event.target.value } as never)} className={field} />
        </div>
      ))}</div>
      <p className="text-[10px] leading-6 text-slate-600">三个角色不填也可以，系统会自动设定。角色立场冲突越多，情境区分度越好。</p>
      <label className={label}>其他要求（选填）<Textarea rows={3} value={form.extra_notes} placeholder="例如：不要出现加班文化内容；希望包含一次客户投诉" onChange={event => update({ extra_notes: event.target.value })} className={field} /></label>
    </motion.div> : null}

    {step === 2 ? <motion.div initial={enabled ? { opacity: 0, x: 10 } : false} animate={{ opacity: 1, x: 0 }} className="grid max-w-[860px] gap-7">
      <div>
        <h3 className="text-[13px] font-normal text-slate-300">重点考察维度（选填）</h3>
        <p className="mt-2 text-[10px] leading-6 text-slate-600">点选岗位特别看重的维度，系统会为它们安排更多表现机会（评分标准不变）。</p>
        <div className="mt-3 flex flex-wrap gap-2">{domains.map(domain => (
          <button key={domain.name} type="button" title={domain.description} onClick={() => setFocus(previous => previous.includes(domain.name) ? previous.filter(item => item !== domain.name) : [...previous, domain.name])} className={cn("cursor-pointer rounded-full border px-3.5 py-2 text-[10.5px] transition-colors", focus.includes(domain.name) ? "border-sky-100/45 bg-sky-100/[.06] text-sky-100" : "border-white/10 bg-white/[.02] text-slate-400 hover:text-slate-200")}>{domain.name}</button>
        ))}</div>
      </div>
      <div>
        <h3 className="text-[13px] font-normal text-slate-300">八维重要性与计分权重</h3>
        <div className="mt-4"><WeightsInput draft={weightsDraft} onChange={setWeightsDraft} /></div>
      </div>
    </motion.div> : null}

    {step === 3 && result ? <div className="grid gap-6">
      <div className="rounded-xl border border-sky-100/[.12] bg-sky-100/[.03] p-5">
        <p className="flex items-center gap-2 text-[12px] text-slate-200"><Sparkles className="size-4 text-sky-100/70" />场景《{result.scenario.title}》已创建并启用</p>
        <p className="mt-2 text-[10px] leading-6 text-slate-500">请检查下方生成内容；不满意可写修改意见让系统再改，或下载文档慢慢审阅（编辑后可在详情页回传）。</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button onClick={() => void downloadDoc()} className="gap-2 bg-slate-200 text-[10px] font-normal text-slate-950 hover:bg-white"><Download className="size-3" />下载配置文档</Button>
          <Button asChild variant="outline" className="gap-2 border-white/15 bg-white/[.025] text-[10px] font-normal text-slate-300"><Link href={`/admin/scenarios/${result.scenario.id}`}><FileText className="size-3" />进入详情页</Link></Button>
          <Button asChild variant="ghost" className="text-[10px] font-normal text-slate-500"><Link href="/admin/scenarios">完成，返回列表</Link></Button>
        </div>
      </div>
      <DefinitionReview definition={result.definition} weights={result.weights} warnings={result.warnings} />
      <div className="rounded-xl border border-white/[.08] bg-white/[.015] p-5">
        <h3 className="text-[13px] font-normal text-slate-300">修改意见</h3>
        <p className="mt-2 text-[10px] leading-6 text-slate-600">简要写下需要调整的地方，系统会按意见重新生成场景（已有测评记录不受影响）。</p>
        <Textarea rows={3} value={feedback} placeholder="例如：把时间压力改得更紧一些；上级角色太温和，希望他更强硬" onChange={event => setFeedback(event.target.value)} className={cn(field, "mt-3")} />
        <div className="mt-4"><Button onClick={() => void applyFeedback()} disabled={revising || !feedback.trim()} className="gap-2 bg-slate-200 text-[10px] font-normal text-slate-950 hover:bg-white">{revising ? "正在按意见修改…" : "按修改意见重新生成"}<ArrowRight className="size-3" /></Button></div>
      </div>
    </div> : null}

    {step < 3 ? <div className="mt-8 flex items-center justify-between border-t border-white/[.065] pt-5">
      <Button variant="ghost" onClick={() => (step === 0 ? router.push("/admin/scenarios") : setStep(value => value - 1))} className="gap-2 text-[11px] font-normal text-slate-500"><ArrowLeft className="size-3.5" />{step === 0 ? "取消" : "上一步"}</Button>
      {step < 2 ? <Button onClick={next} className="gap-5 bg-slate-200 text-[11px] font-normal text-slate-950 hover:bg-white">下一步<ArrowRight className="size-3.5" /></Button>
        : <Button onClick={() => void generate()} disabled={generating} className="gap-3 bg-slate-200 text-[11px] font-normal text-slate-950 hover:bg-white disabled:opacity-70"><Sparkles className="size-3.5" />{generating ? "正在生成…" : "生成场景"}</Button>}
    </div> : null}
  </div>;
}
