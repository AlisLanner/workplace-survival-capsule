import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GE8_DIMENSIONS } from "../../config/dimensions";
import { exportScenarioDocument, generateScenario, reviseScenario } from "../../api/admin.api";
import { ScenarioDefinitionView } from "../../components/admin/ScenarioDefinitionView";
import { buildWeightsPayload, emptyWeightsDraft, WeightsEditor, type WeightsDraft } from "../../components/admin/WeightsEditor";
import type { DimensionWeights, GenerateScenarioResponse, ScenarioDefinition, ScenarioBriefInput } from "../../types/admin";

type Step = 0 | 1 | 2 | 3;

export function ScenarioWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [brief, setBrief] = useState({
    title: "",
    industry: "",
    user_role: "",
    scenario_desc: "",
    job_requirements: "",
    extra_notes: "",
    max_round: 12,
    leaderName: "",
    leaderHint: "",
    coworkerName: "",
    coworkerHint: "",
    clientName: "",
    clientHint: ""
  });
  const [focus, setFocus] = useState<string[]>([]);
  const [weightsDraft, setWeightsDraft] = useState<WeightsDraft>(emptyWeightsDraft(null));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateScenarioResponse | null>(null);
  const [feedback, setFeedback] = useState("");
  const [revising, setRevising] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  function update(patch: Partial<typeof brief>) {
    setBrief((prev) => ({ ...prev, ...patch }));
  }

  function buildPayload(): ScenarioBriefInput {
    return {
      title: brief.title.trim(),
      industry: brief.industry.trim() || undefined,
      user_role: brief.user_role.trim(),
      scenario_desc: brief.scenario_desc.trim(),
      job_requirements: brief.job_requirements.trim() || undefined,
      extra_notes: brief.extra_notes.trim() || undefined,
      focus_dimensions: focus,
      max_round: brief.max_round,
      roles: {
        leader: brief.leaderName.trim() || brief.leaderHint.trim() ? { name: brief.leaderName.trim() || undefined, hint: brief.leaderHint.trim() || undefined } : undefined,
        coworker: brief.coworkerName.trim() || brief.coworkerHint.trim() ? { name: brief.coworkerName.trim() || undefined, hint: brief.coworkerHint.trim() || undefined } : undefined,
        client: brief.clientName.trim() || brief.clientHint.trim() ? { name: brief.clientName.trim() || undefined, hint: brief.clientHint.trim() || undefined } : undefined
      },
      weights_input: buildWeightsPayload(weightsDraft)
    };
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (brief.title.trim().length < 2) return "请填写场景标题（至少2个字）";
      if (brief.user_role.trim().length < 2) return "请填写受测者角色/岗位（例如：门店店长、客服主管）";
    }
    if (step === 1 && brief.scenario_desc.trim().length < 10) {
      return "请描述情境内容（至少10个字）：什么时间、要完成什么任务、遇到什么矛盾或压力";
    }
    return null;
  }

  function next() {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((s) => (s + 1) as Step);
  }

  async function generate() {
    setError(null);
    setGenerating(true);
    setStatusNote("正在生成情境（真实模型约需 1—3 分钟，请勿关闭页面）…");
    try {
      const response = await generateScenario(buildPayload());
      setResult(response);
      setStep(3);
      setStatusNote(
        response.generated_by === "model"
          ? `已由大模型生成并安装（${response.attempts} 次尝试）。请检查下方内容是否符合你的要求。`
          : "当前为离线模式：已按模板生成可用情境。连接真实模型后可在详情页重新修订获得定制内容。"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试");
    } finally {
      setGenerating(false);
    }
  }

  async function applyFeedback() {
    if (!result || !feedback.trim()) return;
    setRevising(true);
    setError(null);
    try {
      const revised = await reviseScenario(result.scenario.id, { instruction: feedback.trim() });
      setResult({
        ...result,
        scenario: revised.scenario,
        definition: revised.definition,
        weights: revised.weights,
        generated_by: revised.generated_by === "document" ? result.generated_by : revised.generated_by
      });
      setFeedback("");
      setStatusNote("已按你的修改意见重新生成，请再次检查。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "修订失败，请稍后重试");
    } finally {
      setRevising(false);
    }
  }

  async function downloadDoc() {
    if (!result) return;
    try {
      const doc = await exportScenarioDocument(result.scenario.id);
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

  const steps = ["岗位信息", "情境内容", "考察重点与权重", "生成与检查"];

  return (
    <>
      <div className="admin-heading">
        <span className="kicker">Scenario Builder</span>
        <h2 className="h2">新建评估场景</h2>
      </div>
      <div className="wizard-steps">
        {steps.map((label, i) => (
          <span key={label} className={`wstep ${i === step ? "on" : ""} ${i < step ? "done" : ""}`}>
            {i + 1}. {label}
          </span>
        ))}
      </div>
      {error ? <p className="error-box">{error}</p> : null}
      {statusNote ? <p className="ok-box">{statusNote}</p> : null}

      {step === 0 ? (
        <article className="glass" style={{ padding: 24 }}>
          <div className="admin-form">
            <label className="f-label">
              场景标题 *（给这个评估场景起个名字）
              <input className="f-input" value={brief.title} maxLength={40} placeholder="例如：门店开业冲刺" onChange={(e) => update({ title: e.target.value })} />
            </label>
            <label className="f-label">
              受测者角色 *（候选人扮演什么岗位）
              <input className="f-input" value={brief.user_role} maxLength={40} placeholder="例如：门店店长、项目经理、客服主管" onChange={(e) => update({ user_role: e.target.value })} />
            </label>
            <label className="f-label">
              行业 / 公司背景（选填）
              <input className="f-input" value={brief.industry} maxLength={100} placeholder="例如：连锁餐饮、跨境电商、软件外包" onChange={(e) => update({ industry: e.target.value })} />
            </label>
            <label className="f-label">
              岗位要求（选填：这个岗位需要什么样的人）
              <textarea className="f-textarea" rows={4} value={brief.job_requirements} placeholder="例如：能扛压、会排班、能协调总部和临时工、成本意识强" onChange={(e) => update({ job_requirements: e.target.value })} />
            </label>
            <label className="f-label">
              对话轮次上限
              <select className="f-input" value={brief.max_round} onChange={(e) => update({ max_round: Number(e.target.value) })}>
                {[10, 12, 15].map((n) => <option key={n} value={n}>{n} 轮（约 {n} 次来回对话）</option>)}
              </select>
            </label>
          </div>
        </article>
      ) : null}

      {step === 1 ? (
        <article className="glass" style={{ padding: 24 }}>
          <div className="admin-form">
            <label className="f-label">
              情境描述 *（说清楚：什么时间、要完成什么任务、遇到什么矛盾或压力）
              <textarea
                className="f-textarea"
                rows={6}
                value={brief.scenario_desc}
                placeholder={"例如：新店开业前三天，人手比计划少三分之一，总部要求开业不能推迟，还要守住首店口碑。店长要在人手、品质、口碑之间做取舍。"}
                onChange={(e) => update({ scenario_desc: e.target.value })}
              />
            </label>
            <div className="roles-grid">
              {([["leader", "上级"], ["coworker", "同级协作方"], ["client", "利益相关方"]] as const).map(([agent, label]) => (
                <div className="role-box" key={agent}>
                  <b>{label}（第{agent === "leader" ? 1 : agent === "coworker" ? 2 : 3}个对话角色）</b>
                  <input
                    className="f-input"
                    placeholder="名字（选填，如 陈总）"
                    value={agent === "leader" ? brief.leaderName : agent === "coworker" ? brief.coworkerName : brief.clientName}
                    maxLength={12}
                    onChange={(e) => update(agent === "leader" ? { leaderName: e.target.value } : agent === "coworker" ? { coworkerName: e.target.value } : { clientName: e.target.value })}
                  />
                  <input
                    className="f-input"
                    placeholder="身份/关注点（选填，如 关注风险和汇报）"
                    value={agent === "leader" ? brief.leaderHint : agent === "coworker" ? brief.coworkerHint : brief.clientHint}
                    maxLength={60}
                    onChange={(e) => update(agent === "leader" ? { leaderHint: e.target.value } : agent === "coworker" ? { coworkerHint: e.target.value } : { clientHint: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <p className="small muted">三个角色不填也可以，系统会自动设定。角色越多立场冲突，情境越有区分度。</p>
            <label className="f-label">
              其他要求（选填）
              <textarea className="f-textarea" rows={3} value={brief.extra_notes} placeholder="例如：不要出现加班文化相关内容；希望包含一次客户投诉" onChange={(e) => update({ extra_notes: e.target.value })} />
            </label>
          </div>
        </article>
      ) : null}

      {step === 2 ? (
        <article className="glass" style={{ padding: 24 }}>
          <h3>重点考察维度（选填）</h3>
          <p className="small muted">点选这个岗位特别看重的维度，系统会为它们安排更多表现机会（评分标准不变，仍按八维打分）。</p>
          <div className="focus-chips">
            {GE8_DIMENSIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`chip-btn ${focus.includes(d.id) ? "on" : ""}`}
                title={d.meaning}
                onClick={() => setFocus((prev) => (prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]))}
              >
                {d.name}
              </button>
            ))}
          </div>
          <h3 style={{ marginTop: 24 }}>八维重要性与计分权重</h3>
          <WeightsEditor draft={weightsDraft} onChange={setWeightsDraft} />
        </article>
      ) : null}

      {step === 3 && result ? (
        <>
          <article className="glass" style={{ padding: 24 }}>
            <h3>生成结果检查</h3>
            <p className="small muted">
              场景《{result.scenario.title}》已创建并启用。请检查下方生成的情境内容是否符合你的要求；
              不满意可直接写修改意见让系统再改，也可以下载文档慢慢看。
            </p>
            <div className="wizard-actions">
              <button className="btn btn-gold" onClick={downloadDoc}>下载配置文档（可编辑回传）</button>
              <button className="btn" onClick={() => navigate(`/admin/scenarios/${result.scenario.id}`)}>进入详情页</button>
              <button className="btn" onClick={() => navigate("/admin/scenarios")}>完成，返回列表</button>
            </div>
          </article>
          <ScenarioDefinitionView definition={result.definition} weights={result.weights} warnings={result.warnings} />
          <article className="glass" style={{ padding: 24, marginTop: 20 }}>
            <h3>修改意见</h3>
            <p className="small muted">简要写下需要调整的地方，系统会按意见重新生成场景（已有测评记录不受影响）。</p>
            <textarea
              className="f-textarea"
              rows={3}
              value={feedback}
              placeholder="例如：把时间压力改得更紧一些；上级角色太温和，希望他更强硬；增加一个成本约束"
              onChange={(e) => setFeedback(e.target.value)}
            />
            <div className="wizard-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-gold" disabled={revising || !feedback.trim()} onClick={applyFeedback}>
                {revising ? "正在按意见修改…" : "按修改意见重新生成"}
              </button>
            </div>
          </article>
        </>
      ) : null}

      {step < 3 ? (
        <div className="wizard-actions">
          {step > 0 ? <button className="btn" onClick={() => setStep((s) => (s - 1) as Step)}>上一步</button> : <button className="btn" onClick={() => navigate("/admin/scenarios")}>取消</button>}
          {step < 2 ? (
            <button className="btn btn-gold" onClick={next}>下一步</button>
          ) : (
            <button className="btn btn-gold" disabled={generating} onClick={generate}>
              {generating ? "正在生成…" : "生成场景"}
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}
