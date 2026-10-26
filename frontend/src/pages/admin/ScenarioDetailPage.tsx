import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  deleteAdminScenario,
  exportScenarioDocument,
  getScenarioDetail,
  importScenarioDocument,
  reviseScenario,
  updateAdminScenario,
  updateScenarioWeights
} from "../../api/admin.api";
import { ScenarioDefinitionView } from "../../components/admin/ScenarioDefinitionView";
import { buildWeightsPayload, emptyWeightsDraft, WeightsEditor, WeightsSummary, type WeightsDraft } from "../../components/admin/WeightsEditor";
import type { ScenarioDetailResponse } from "../../types/admin";

export function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ScenarioDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<"content" | "weights" | "document">("content");
  const [weightsDraft, setWeightsDraft] = useState<WeightsDraft | null>(null);
  const [savingWeights, setSavingWeights] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [docMarkdown, setDocMarkdown] = useState("");
  const [docLoaded, setDocLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const data = await getScenarioDetail(id);
      setDetail(data);
      setWeightsDraft(emptyWeightsDraft(data.weights));
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!detail) {
    return (
      <main>
        {error ? <p className="error-box">{error}</p> : <p className="loading">加载场景详情…</p>}
      </main>
    );
  }

  const { scenario, definition, weights } = detail;
  const isCustom = scenario.origin === "custom";
  const isLegacy = !scenario.assessmentVersion;

  async function saveWeights() {
    if (!id || !weightsDraft) return;
    setSavingWeights(true);
    setError(null);
    setNote(null);
    try {
      const response = await updateScenarioWeights(id, buildWeightsPayload(weightsDraft));
      setNote(response.note ?? "权重已保存。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingWeights(false);
    }
  }

  async function revise(instructionText: string, markdown?: string) {
    if (!id) return;
    setRevising(true);
    setError(null);
    setNote(null);
    try {
      const revised = await reviseScenario(id, { instruction: instructionText || undefined, markdown });
      setNote(`已重新生成（版本 ${revised.scenario.assessmentVersion}）。${revised.applied?.document_changes?.length ? `文档改动：${revised.applied.document_changes.join("、")}。` : ""}`);
      setInstruction("");
      setDocLoaded(false);
      setTab("content");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "修订失败");
    } finally {
      setRevising(false);
    }
  }

  async function loadDoc() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await exportScenarioDocument(id);
      setDocMarkdown(doc.markdown);
      setDocLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "文档加载失败");
    } finally {
      setBusy(false);
    }
  }

  async function uploadDoc() {
    if (!id || !docMarkdown.trim()) return;
    await revise("", docMarkdown);
  }

  async function downloadDoc() {
    if (!id) return;
    try {
      const doc = await exportScenarioDocument(id);
      const blob = new Blob([doc.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "文档导出失败");
    }
  }

  async function toggleStatus() {
    if (!id) return;
    setBusy(true);
    try {
      await updateAdminScenario(id, { status: scenario.status === "active" ? "inactive" : "active" } as never);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id) return;
    if (!window.confirm(`确定删除场景《${scenario.title}》？此操作不可恢复。已有测评记录的场景无法删除。`)) return;
    setBusy(true);
    try {
      await deleteAdminScenario(id);
      navigate("/admin/scenarios");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-heading">
        <span className="kicker">Scenario Detail</span>
        <h2 className="h2">{scenario.title}</h2>
      </div>
      {error ? <p className="error-box">{error}</p> : null}
      {note ? <p className="ok-box">{note}</p> : null}

      <article className="glass" style={{ padding: 24, marginBottom: 20 }}>
        <div className="scn-meta" style={{ marginBottom: 12 }}>
          <span className="chip">{scenario.origin === "custom" ? "自定义生成" : scenario.origin === "builtin" ? "内置正式情境" : "旧版演示"}</span>
          <span className="chip">{scenario.status === "active" ? "启用中" : "已停用"}</span>
          <span className="chip">{scenario.maxRound} 轮</span>
          <span className="chip">已产生 {scenario.sessionCount ?? 0} 个会话</span>
          {scenario.assessmentVersion ? <span className="chip">{scenario.assessmentVersion}</span> : null}
        </div>
        <p className="small muted">{scenario.description}</p>
        <div style={{ margin: "12px 0" }}>
          <WeightsSummary weights={weights} />
        </div>
        <div className="wizard-actions">
          <button className="btn" disabled={busy} onClick={toggleStatus}>{scenario.status === "active" ? "停用（候选人端隐藏）" : "启用"}</button>
          <button className="btn danger" disabled={busy} onClick={remove}>删除场景</button>
        </div>
      </article>

      <div className="detail-tabs">
        {([["content", "情境内容"], ["weights", "八维权重"], ["document", "配置文档"]] as const).map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? "on" : ""}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === "content" ? (
        definition ? (
          <>
            <ScenarioDefinitionView definition={definition} weights={weights} />
            {isCustom ? (
              <article className="glass" style={{ padding: 24, marginTop: 20 }}>
                <h3>修改意见</h3>
                <p className="small muted">简要写下需要调整的地方（也可以在“配置文档”页编辑文档后回传）。</p>
                <textarea className="f-textarea" rows={3} value={instruction} placeholder="例如：时间压力再紧一些；增加预算约束" onChange={(e) => setInstruction(e.target.value)} />
                <div className="wizard-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-gold" disabled={revising || !instruction.trim()} onClick={() => revise(instruction)}>
                    {revising ? "正在修改…" : "按意见重新生成"}
                  </button>
                </div>
              </article>
            ) : (
              <p className="small muted" style={{ marginTop: 16 }}>内置正式情境的任务内容已冻结（保证测量口径一致）；可在此调整状态与八维权重。</p>
            )}
          </>
        ) : (
          <article className="glass" style={{ padding: 24 }}>
            <h3>任务卡（候选人可见）</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{scenario.backgroundForUser}</p>
            <p className="small muted">旧版演示场景：使用旧版流程与维度，不支持八维文档与加权计分。</p>
          </article>
        )
      ) : null}

      {tab === "weights" && weightsDraft ? (
        <article className="glass" style={{ padding: 24 }}>
          <h3>八维重要性与计分权重</h3>
          {isLegacy ? <p className="small muted">注意：该场景是旧版演示流程，报告暂不参与八维加权计分。</p> : null}
          <WeightsEditor draft={weightsDraft} onChange={setWeightsDraft} />
          <div className="wizard-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-gold" disabled={savingWeights} onClick={saveWeights}>{savingWeights ? "保存中…" : "保存权重"}</button>
          </div>
        </article>
      ) : null}

      {tab === "document" ? (
        <article className="glass" style={{ padding: 24 }}>
          <h3>配置文档（审阅 / 编辑 / 回传）</h3>
          {isLegacy ? (
            <p className="small muted">旧版演示场景暂不支持文档导出。</p>
          ) : (
            <>
              <p className="small muted">
                文档包含场景的全部配置（事实、角色、观察点、权重）。你可以：① 下载后离线审阅或转给业务负责人圈阅；
                ② 直接编辑下方文档文本（或粘贴编辑后的整篇文档），点击“回传文档”让系统按改动更新场景；
                ③ 在文档末尾“修改意见”区写修改要求，回传时系统会一并处理。
              </p>
              <div className="wizard-actions">
                <button className="btn" disabled={busy} onClick={loadDoc}>{docLoaded ? "重新载入文档" : "载入文档"}</button>
                <button className="btn" disabled={busy} onClick={downloadDoc}>下载文档</button>
                <button className="btn btn-gold" disabled={!docLoaded || busy} onClick={uploadDoc}>回传文档（按编辑更新场景）</button>
              </div>
              {docLoaded ? (
                <textarea className="f-textarea doc-edit" rows={24} value={docMarkdown} onChange={(e) => setDocMarkdown(e.target.value)} />
              ) : null}
            </>
          )}
        </article>
      ) : null}
    </>
  );
}
