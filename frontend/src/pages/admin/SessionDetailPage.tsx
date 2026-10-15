import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { getAdminSessionDetail } from "../../api/admin.api";
import { GroupDiscussionPanel } from "../../components/admin/GroupDiscussionPanel";
import { SessionReplay } from "../../components/admin/SessionReplay";
import { RadarChart } from "../../components/RadarChart";
import { ReportSection } from "../../components/ReportSection";
import { getDimensionColor, getDimensionLabel } from "../../config/dimensions";
import { useReveal } from "../../hooks/useReveal";
import type { AdminSessionDetail } from "../../types/admin";
import type { AgentTraceEvent, Report } from "../../types/assessment";

function confidenceLevel(variance: number) {
  if (variance < 30) return { label: "高可信", cls: "conf-high" };
  if (variance < 80) return { label: "中可信", cls: "conf-mid" };
  return { label: "建议人工复核", cls: "conf-low" };
}

function statusMeta(report?: Report | null) {
  if (!report) return { label: "无报告", cls: "conf-low", note: "" };
  if (report.report_status === "scoring_failed") {
    return { label: "评分失败", cls: "conf-low", note: "评分服务暂时不可用，请稍后重试。" };
  }
  if (report.report_status === "debug" || report.mock_generated) {
    return { label: "调试报告", cls: "conf-low", note: "本报告由本地 mock Judge Agent 生成，仅用于调试。" };
  }
  if (report.report_status === "unratable") {
    return {
      label: "仅观察反馈",
      cls: "conf-low",
      note: report.human_review_reason?.includes("采样")
        ? "Judge Agent 采样分歧过大，当前结果仅保留为观察记录。"
        : "本次未形成可评分证据（如单轮计时结束），当前结果仅保留为观察记录。"
    };
  }
  if (report.report_status === "provisional") {
    return { label: "观察性反馈", cls: "conf-mid", note: "观察点覆盖不足，参考指数仅作发展反馈，不建议横向比较。" };
  }
  return { label: "本次观察结果", cls: "conf-high", note: "当前报告通过采样和覆盖检查，可作为本次模拟评估的参考结果。" };
}

function scoringFailureReason(report?: Report | null) {
  return report?.scoring_error_reason ?? report?.reason ?? report?.human_review_reason ?? "评分服务暂时不可用，请稍后重试。";
}

function traceStatusText(status: AgentTraceEvent["status"]) {
  if (status === "running") return "运行中";
  if (status === "completed") return "完成";
  if (status === "skipped") return "跳过";
  if (status === "failed") return "失败";
  return "等待";
}

function formatTraceTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("zh-CN", { hour12: false });
}

function GraphTimeline({ events }: { events: AgentTraceEvent[] }) {
  if (!events.length) {
    return <p className="muted">暂无 graph trace。新一轮对话完成后会写入节点轨迹。</p>;
  }

  return (
    <div className="graph-timeline">
      {events.map((event) => (
        <article className={`timeline-item tl-${event.status}`} key={event.id}>
          <span className="tl-dot" />
          <div>
            <div className="tl-meta">
              <strong>
                {event.nodeId} · {event.agentName}
              </strong>
              <span>{traceStatusText(event.status)}</span>
              <span>{event.elapsedMs != null ? `${event.elapsedMs}ms` : formatTraceTime(event.createdAt)}</span>
            </div>
            {event.summary ? <p>{event.summary}</p> : null}
            {event.payload ? (
              <details>
                <summary>安全 payload</summary>
                <pre>{JSON.stringify(event.payload, null, 2)}</pre>
              </details>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

const sectionStyle: CSSProperties = { padding: "28px", marginTop: "20px" };

export function SessionDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<AdminSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dimsReveal = useReveal<HTMLDivElement>();

  useEffect(() => {
    if (!id) return;
    getAdminSessionDetail(id)
      .then(setDetail)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  const heading = (
    <div className="admin-heading">
      <span className="kicker">Admin · Session</span>
      <h2 className="h2">会话详情</h2>
    </div>
  );

  if (error) {
    return (
      <>
        {heading}
        <p className="error-box">{error}</p>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        {heading}
        <p className="loading">加载会话详情...</p>
      </>
    );
  }

  const s = detail.session;
  const report = detail.report as Report | null;
  const scoringFailed = report?.report_status === "scoring_failed";
  const scoreableReport = report && !scoringFailed ? report : null;
  const conf = scoreableReport?.sampling_stats ? confidenceLevel(scoreableReport.sampling_stats.variance) : null;
  const status = statusMeta(report);
  const sortedDims = scoreableReport ? Object.entries(scoreableReport.dimension_scores).sort((a, b) => b[1] - a[1]) : [];
  const dimKeys = scoreableReport ? Object.keys(scoreableReport.dimension_scores) : [];
  const formalScore = scoreableReport?.report_status === "confident" && !scoreableReport.mock_generated;
  const displayedScore = formalScore ? (s.totalScore ?? scoreableReport?.total_score ?? "—") : "未形成";
  const statusClass =
    s.status === "finished" ? "st-finished" : s.status === "running" ? "st-running" : s.status === "abandoned" ? "st-abandoned" : "";
  const statusText =
    s.status === "finished"
      ? "已完成"
      : s.status === "running"
        ? "进行中"
        : s.status === "abandoned"
          ? "已超时"
          : s.status === "scoring_failed"
            ? "评分失败"
            : s.status;

  return (
    <>
      {heading}

      <section className="session-console glass" aria-label="会话概览">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className={`st-pill ${statusClass}`}>{statusText}</span>
          <span className="chip">轮次 {s.round}</span>
          <span className="chip">参考指数 {displayedScore}</span>
          <span className={`conf ${status.cls}`}>{status.label}</span>
          <span className="t-id">{id}</span>
        </div>
      </section>

      {scoringFailed ? (
        <section className="glass" style={sectionStyle}>
          <div className="sec-title">评分失败</div>
          <p className="muted">{scoringFailureReason(report)}</p>
          <p className="muted">会话回放和黑板状态仍保留，当前没有可展示的参考指数。</p>
        </section>
      ) : report ? (
        <>
          <div className="report-hero" style={{ marginTop: 28 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span className="chip">观察区间 · {report.level}</span>
              <span className="chip">冲突风格 · {report.conflict_style}</span>
              {conf ? (
                <span
                  className={`conf ${conf.cls}`}
                  title={`采样结果: [${report.sampling_stats!.scores.join(", ")}] · 方差: ${report.sampling_stats!.variance}`}
                >
                  {conf.label} · σ²={report.sampling_stats!.variance}
                </span>
              ) : null}
              {report.coverage_status ? (
                <span className={`conf ${report.coverage_status.complete ? "conf-high" : "conf-mid"}`}>
                  观察点覆盖 {report.coverage_status.covered_dimensions.length}/
                  {report.coverage_status.covered_dimensions.length + report.coverage_status.insufficient_dimensions.length}
                </span>
              ) : null}
              {report.human_review_required ? (
                <span className="conf conf-low" title={report.human_review_reason || "需要人工复核"}>
                  需复核
                </span>
              ) : null}
            </div>
            {report.summary ? <p className="muted">{report.summary}</p> : null}
            {status.note ? <p className="muted">{status.note}</p> : null}
            {report.human_review_reason ? <p className="muted">{report.human_review_reason}</p> : null}
          </div>

          {report.sampling_stats ? (
            <section className="confidence-strip" aria-label="采样一致性" style={{ marginTop: 20 }}>
              <div>
                <span className="small">Judge Agent 五次采样</span>
                <div className="confidence-scores">
                  {report.sampling_stats.scores.map((sc, i) => (
                    <span key={i} className="confidence-score-chip">{sc}</span>
                  ))}
                </div>
              </div>
              <div className="confidence-bar">
                <div
                  className={`confidence-bar-fill ${conf!.cls}`}
                  style={{ width: `${Math.min(100, (report.sampling_stats.variance / 120) * 100)}%` }}
                />
              </div>
              <span className="small">方差 {report.sampling_stats.variance} · {conf!.label}</span>
            </section>
          ) : null}

          {report.coverage_status ? (
            <section className="coverage-strip" style={{ marginTop: 20 }}>
              <div>
                <strong>已观察维度</strong>
                <span>
                  {report.coverage_status.covered_dimensions.length
                    ? report.coverage_status.covered_dimensions.map(getDimensionLabel).join("、")
                    : "暂无"}
                </span>
              </div>
              <div>
                <strong>证据不足维度</strong>
                <span>
                  {report.coverage_status.insufficient_dimensions.length
                    ? report.coverage_status.insufficient_dimensions.map(getDimensionLabel).join("、")
                    : "无"}
                </span>
              </div>
            </section>
          ) : null}

          <div className="report-grid" style={{ marginTop: 32 }}>
            <div className="radar-card glass">
              <RadarChart data={report.radar_chart_data} />
              <div className={`score-big${formalScore ? "" : " score-big-muted"}`}>
                <div className="v">{displayedScore}</div>
                <div className="c">综合参考指数</div>
              </div>
            </div>
            <div className="report-side">
              <div className="sec-title">维度得分</div>
              <div className="dims" ref={dimsReveal}>
                {sortedDims.map(([key, value], i) => {
                  const pct = Math.round((value / 20) * 100);

                  return (
                    <div className="dim" key={key}>
                      <span className="name">{getDimensionLabel(key)}</span>
                      <div className="track">
                        <div className="fill" style={{ "--w": `${pct}%`, "--d": `${i * 0.06}s` } as CSSProperties} />
                      </div>
                      <span className="val">{value}/20</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="sec-title" style={{ marginTop: 36 }}>维度分析</div>
          <div className="dim-analysis-grid">
            {Object.entries(report.dimension_analysis).map(([key, analysis]) => {
              const color = getDimensionColor(dimKeys, key);
              return (
                <article className="dim-analysis-card" key={key} style={{ borderLeftColor: color }}>
                  <span className="dim-analysis-label" style={{ color }}>{getDimensionLabel(key)}</span>
                  <p>{analysis}</p>
                </article>
              );
            })}
          </div>

          <div className="report-copy" style={{ marginTop: 20 }}>
            <ReportSection title="能力优势" items={report.strengths} />
            <ReportSection title="发展关注点" items={report.risks} />
            <ReportSection title="改进建议" items={report.suggestions} />
          </div>

          <div className="sec-title" style={{ marginTop: 36 }}>关键证据链</div>
          <div className="evidence-grid">
            {report.evidence.map((item, i) => {
              const color = getDimensionColor(dimKeys, item.dimension);
              return (
                <article className="evidence-card" key={i} style={{ borderLeftColor: color }}>
                  <span className="evidence-dim-tag" style={{ color, background: `${color}10` }}>
                    {getDimensionLabel(item.dimension)}
                  </span>
                  <blockquote>{item.quote}</blockquote>
                  <p>{item.analysis}</p>
                </article>
              );
            })}
          </div>

          {report.final_recommendation ? (
            <section className="final-card" style={{ marginTop: 20 }}>
              <h3>发展建议</h3>
              <p>{report.final_recommendation}</p>
            </section>
          ) : null}
        </>
      ) : (
        <section className="glass" style={sectionStyle}>
          <div className="sec-title">报告</div>
          <p className="muted">
            {s.status === "scoring_failed"
              ? "评分服务暂时不可用，请稍后重试。"
              : s.status === "finished"
                ? "报告数据缺失。"
                : "会话尚未结束，报告将在评估完成后生成。"}
          </p>
        </section>
      )}

      <section className="glass" style={sectionStyle}>
        <div className="sec-title">Agent 轨迹</div>
        <GraphTimeline events={detail.agent_trace ?? []} />
      </section>

      <section className="glass" style={sectionStyle}>
        <div className="sec-title">消息回放</div>
        <SessionReplay messages={detail.messages} />
      </section>

      <section className="glass" style={sectionStyle}>
        <div className="sec-title">群聊记录</div>
        <GroupDiscussionPanel discussions={detail.group_discussions} />
      </section>

      <section className="glass" style={sectionStyle}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "1.05rem" }}>黑板状态（原始数据）</summary>
          <pre style={{ marginTop: 12 }}>{JSON.stringify(detail.session.blackboardState, null, 2)}</pre>
        </details>
      </section>
    </>
  );
}
