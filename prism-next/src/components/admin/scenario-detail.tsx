"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, FileDown, Upload, RefreshCw, Save } from "lucide-react";
import { exportScenarioDocument, getScenarioDetail, importScenarioDocument, reviseScenario, updateScenarioWeights } from "@/lib/api";
import type { ScenarioDetailResponse } from "@/lib/types";
import { AdminHeading } from "./admin-shell";
import { DefinitionReview } from "./definition-review";
import { WeightsInput, buildWeightsPayload, emptyWeightsDraft, type WeightsDraft } from "./weights-input";
import { TransitionLink as Link } from "../transition-link";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";

type Tab = "content" | "weights" | "document";

/** 场景详情：内容审阅与修订、八维权重（四模式）、配置文档导出/回传。 */
export function ScenarioDetail({ scenarioId }: { scenarioId: string }) {
  const [detail, setDetail] = useState<ScenarioDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("content");
  const [weightsDraft, setWeightsDraft] = useState<WeightsDraft | null>(null);
  const [savingWeights, setSavingWeights] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [docMarkdown, setDocMarkdown] = useState("");
  const [docLoaded, setDocLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() { setDetail(await getScenarioDetail(scenarioId)); }
  useEffect(() => { load().catch(err => setError(err instanceof Error ? err.message : "读取失败")).finally(() => setWeightsDraft(previous => previous)); }, [scenarioId]);
  useEffect(() => { if (detail && !weightsDraft) setWeightsDraft(emptyWeightsDraft(detail.weights)); }, [detail, weightsDraft]);

  if (error && !detail) return <div className="rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-8 text-center text-[12px] text-rose-200/80" role="alert">{error}</div>;
  if (!detail || !weightsDraft) return <div className="grid h-[240px] place-items-center text-[11px] text-slate-600" role="status">正在读取场景详情…</div>;

  const { scenario, definition, weights } = detail;
  const isCustom = scenario.origin === "custom";
  const isLegacy = !scenario.assessmentVersion;

  async function saveWeights() {
    setSavingWeights(true); setError(null); setNote(null);
    try {
      const response = await updateScenarioWeights(scenarioId, buildWeightsPayload(weightsDraft!));
      setNote(response.note ?? "权重已保存。");
      await load(); setWeightsDraft(emptyWeightsDraft(response.weights));
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败"); } finally { setSavingWeights(false); }
  }

  async function revise(instructionText: string, markdown?: string) {
    setRevising(true); setError(null); setNote(null);
    try {
      const revised = await reviseScenario(scenarioId, { instruction: instructionText || undefined, markdown });
      setNote(`已重新生成（版本 ${revised.scenario.assessmentVersion}）。${revised.applied?.document_changes?.length ? `文档改动：${revised.applied.document_changes.join("、")}。` : ""}`);
      setInstruction(""); setDocLoaded(false); setTab("content");
      await load(); setWeightsDraft(emptyWeightsDraft(revised.weights));
    } catch (err) { setError(err instanceof Error ? err.message : "修订失败"); } finally { setRevising(false); }
  }

  async function loadDoc() {
    setBusy(true); setError(null);
    try { const doc = await exportScenarioDocument(scenarioId); setDocMarkdown(doc.markdown); setDocLoaded(true); }
    catch (err) { setError(err instanceof Error ? err.message : "文档加载失败"); } finally { setBusy(false); }
  }
  async function downloadDoc() {
    try {
      const doc = await exportScenarioDocument(scenarioId);
      const blob = new Blob([doc.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = doc.filename; anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : "文档导出失败"); }
  }

  return <div>
    <AdminHeading kicker="STUDIO / SCENARIO DETAIL" title={scenario.title} description={`${scenario.description} · ${scenario.sessionCount ?? 0} 个会话 · ${scenario.status === "active" ? "启用中" : "已停用"}`} />
    <Button asChild variant="ghost" size="sm" className="-mt-3 mb-6 gap-2.5 text-[10px] font-normal text-slate-500 hover:bg-white/[.03]"><Link href="/admin/scenarios"><ArrowLeft className="size-3.5" />返回场景列表</Link></Button>
    {error ? <p className="mb-4 rounded-lg border border-rose-300/20 bg-rose-300/[.04] px-4 py-3 text-[11px] text-rose-200/85" role="alert">{error}</p> : null}
    {note ? <p className="mb-4 rounded-lg border border-sky-100/15 bg-sky-100/[.04] px-4 py-3 text-[11px] text-sky-100/75" role="status">{note}</p> : null}
    <div className="mb-6 flex gap-2">{([["content", "情境内容"], ["weights", "八维权重"], ["document", "配置文档"]] as Array<[Tab, string]>).map(([key, labelText]) => (
      <button key={key} onClick={() => setTab(key)} className={cn("cursor-pointer rounded-full border px-4 py-2 text-[10.5px] transition-colors", tab === key ? "border-sky-100/40 bg-sky-100/[.06] text-sky-100" : "border-white/10 bg-white/[.02] text-slate-500 hover:text-slate-200")}>{labelText}</button>
    ))}</div>

    {tab === "content" ? definition ? <>
      <DefinitionReview definition={definition} weights={weights} />
      {isCustom ? <div className="mt-5 rounded-xl border border-white/[.08] bg-white/[.015] p-5">
        <h3 className="text-[13px] font-normal text-slate-300">修改意见</h3>
        <p className="mt-2 text-[10px] leading-6 text-slate-600">简要写下需要调整的地方（也可以在“配置文档”页编辑文档后回传）。</p>
        <Textarea rows={3} value={instruction} placeholder="例如：时间压力再紧一些；增加预算约束" onChange={event => setInstruction(event.target.value)} className="mt-3 border-white/10 bg-white/[.025] text-[12px] placeholder:text-slate-700 focus:border-sky-100/30" />
        <div className="mt-4"><Button onClick={() => void revise(instruction)} disabled={revising || !instruction.trim()} className="gap-2 bg-slate-200 text-[10px] font-normal text-slate-950 hover:bg-white disabled:opacity-60"><RefreshCw className="size-3" />{revising ? "正在修改…" : "按意见重新生成"}</Button></div>
      </div> : <p className="mt-5 text-[10px] leading-6 text-slate-600">内置正式情境的任务内容已冻结（保证测量口径一致）；可在此调整状态与八维权重。</p>}
    </> : <div className="rounded-xl border border-white/[.075] bg-[#0f1721]/70 p-6">
      <h3 className="text-[13px] font-normal text-slate-200">任务卡（候选人可见）</h3>
      <p className="mt-3 whitespace-pre-line text-[12px] leading-8 text-slate-400">{scenario.backgroundForUser}</p>
      <p className="mt-3 text-[10px] text-slate-600">旧版演示场景：使用旧版流程与维度，不支持八维文档与加权计分。</p>
    </div> : null}

    {tab === "weights" ? <div className="rounded-xl border border-white/[.075] bg-[#0f1721]/70 p-5">
      <h3 className="text-[13px] font-normal text-slate-300">八维重要性与计分权重</h3>
      {isLegacy ? <p className="mt-2 text-[10px] text-slate-600">注意：该场景是旧版演示流程，报告暂不参与八维加权计分。</p> : null}
      <div className="mt-4"><WeightsInput draft={weightsDraft} onChange={setWeightsDraft} /></div>
      <div className="mt-5"><Button onClick={() => void saveWeights()} disabled={savingWeights} className="gap-2 bg-slate-200 text-[10px] font-normal text-slate-950 hover:bg-white disabled:opacity-60"><Save className="size-3" />{savingWeights ? "保存中…" : "保存权重"}</Button></div>
    </div> : null}

    {tab === "document" ? isLegacy ? <p className="text-[11px] text-slate-600">旧版演示场景暂不支持文档导出。</p> : <div className="rounded-xl border border-white/[.075] bg-[#0f1721]/70 p-5">
      <h3 className="text-[13px] font-normal text-slate-300">配置文档（审阅 / 编辑 / 回传）</h3>
      <p className="mt-2 text-[10px] leading-6 text-slate-600">文档包含场景的全部配置（事实、角色、观察点、权重）。可以下载离线审阅或转给业务负责人圈阅；也可以直接编辑下方文档文本（或粘贴编辑后的整篇文档）回传，系统按改动更新场景；文末“修改意见”区的文字会一并处理。</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button variant="outline" onClick={() => void loadDoc()} disabled={busy} className="gap-2 border-white/15 bg-white/[.025] text-[10px] font-normal text-slate-300"><FileDown className="size-3" />{docLoaded ? "重新载入文档" : "载入文档"}</Button>
        <Button variant="outline" onClick={() => void downloadDoc()} disabled={busy} className="gap-2 border-white/15 bg-white/[.025] text-[10px] font-normal text-slate-300"><FileDown className="size-3" />下载文档</Button>
        <Button onClick={() => void revise("", docMarkdown)} disabled={!docLoaded || busy} className="gap-2 bg-slate-200 text-[10px] font-normal text-slate-950 hover:bg-white disabled:opacity-60"><Upload className="size-3" />回传文档（按编辑更新场景）</Button>
      </div>
      {docLoaded ? <Textarea rows={20} value={docMarkdown} onChange={event => setDocMarkdown(event.target.value)} className="mt-4 font-mono text-[11px] leading-6" aria-label="配置文档编辑" /> : null}
    </div> : null}
  </div>;
}
