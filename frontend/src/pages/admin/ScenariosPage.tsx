import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createSimpleScenario, deleteAdminScenario, listAdminScenarios, updateAdminScenario } from "../../api/admin.api";
import { WeightsSummary } from "../../components/admin/WeightsEditor";
import type { AdminScenario } from "../../types/admin";

const ORIGIN_LABEL: Record<string, string> = { custom: "自定义生成", builtin: "内置正式情境", legacy: "旧版演示" };

export function ScenariosPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<AdminScenario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [simpleTitle, setSimpleTitle] = useState("");

  async function load() {
    try {
      setScenarios(await listAdminScenarios());
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleStatus(scenario: AdminScenario) {
    setBusyId(scenario.id);
    setError(null);
    try {
      await updateAdminScenario(scenario.id, { status: scenario.status === "active" ? "inactive" : "active" } as never);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(scenario: AdminScenario) {
    if (!window.confirm(`确定删除场景《${scenario.title}》？已有测评记录的场景无法删除（可改为停用）。`)) return;
    setBusyId(scenario.id);
    setError(null);
    try {
      await deleteAdminScenario(scenario.id);
      setNote(`已删除《${scenario.title}》。`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  }

  async function createSimple() {
    if (simpleTitle.trim().length < 2) {
      setError("请填写场景标题（至少2个字）");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createSimpleScenario({ title: simpleTitle.trim() });
      setSimpleTitle("");
      setNote("已创建空白简单场景（旧版演示流程）。如需八维计分，建议使用“新建评估场景”向导。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="admin-heading">
        <span className="kicker">Scenario Ops</span>
        <h2 className="h2">场景管理</h2>
      </div>
      <p className="muted small" style={{ marginBottom: 16 }}>
        在这里为你的岗位创建和调整评估场景：用“新建评估场景”填写岗位与情境信息即可自动生成；
        内置正式情境经过试测验证、内容冻结，可停用或调整八维权重。权重会影响报告的加权总分。
      </p>
      {error ? <p className="error-box">{error}</p> : null}
      {note ? <p className="ok-box">{note}</p> : null}

      <div className="wizard-actions" style={{ marginBottom: 20 }}>
        <button className="btn btn-gold" onClick={() => navigate("/admin/scenarios/new")}>＋ 新建评估场景（推荐）</button>
      </div>
      <details className="glass" style={{ padding: 16, marginBottom: 20 }}>
        <summary className="small muted">高级：创建空白简单场景（旧版演示流程，不做八维计分）</summary>
        <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="f-input" style={{ maxWidth: 320 }} value={simpleTitle} placeholder="简单场景标题" onChange={(e) => setSimpleTitle(e.target.value)} />
          <button className="btn" disabled={creating} onClick={createSimple}>{creating ? "创建中…" : "创建"}</button>
        </div>
      </details>

      <div className="admin-stack">
        {scenarios.map((scenario) => (
          <article className="glass scn-admin-card" key={scenario.id}>
            <div className="scn-admin-head">
              <div>
                <h3 style={{ marginBottom: 6 }}>
                  <Link to={`/admin/scenarios/${scenario.id}`}>{scenario.title}</Link>
                </h3>
                <div className="scn-meta">
                  <span className="chip">{ORIGIN_LABEL[scenario.origin ?? "legacy"] ?? scenario.origin}</span>
                  <span className={`chip ${scenario.status === "active" ? "" : "muted"}`}>{scenario.status === "active" ? "启用中" : "已停用"}</span>
                  <span className="chip">{scenario.maxRound} 轮</span>
                  <span className="chip">{scenario.sessionCount ?? 0} 个会话</span>
                  {scenario.weightsCustomized ? <span className="chip hot">已设权重</span> : null}
                </div>
                <p className="small muted" style={{ marginTop: 8 }}>{scenario.description}</p>
              </div>
              <div className="scn-admin-actions">
                <Link className="btn" to={`/admin/scenarios/${scenario.id}`}>配置 / 详情</Link>
                <button className="btn" disabled={busyId === scenario.id} onClick={() => toggleStatus(scenario)}>
                  {scenario.status === "active" ? "停用" : "启用"}
                </button>
                <button className="btn danger" disabled={busyId === scenario.id} onClick={() => remove(scenario)}>删除</button>
              </div>
            </div>
            {scenario.dimensionWeights ? <WeightsSummary weights={scenario.dimensionWeights} /> : null}
          </article>
        ))}
      </div>
    </>
  );
}
