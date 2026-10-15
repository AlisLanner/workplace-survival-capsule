import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { getReport, getSession } from "../api/assessment.api";
import { RadarChart } from "../components/RadarChart";
import { ReportSection } from "../components/ReportSection";
import { getDimensionLabel } from "../config/dimensions";
import { useCountUp } from "../hooks/useCountUp";
import { useReveal } from "../hooks/useReveal";
import { useSpotlight } from "../hooks/useSpotlight";
import type { Report } from "../types/assessment";

function confidenceLevel(variance: number) {
  if (variance < 30) return { label: "高可信", cls: "conf-high" };
  if (variance < 80) return { label: "中可信", cls: "conf-mid" };
  return { label: "建议人工复核", cls: "conf-low" };
}

function statusMeta(report: Report) {
  if (report.report_status === "scoring_failed") {
    return {
      label: "评分失败",
      cls: "conf-low",
      note: "对话记录已保留，稍后重进本页即可查看结果。"
    };
  }
  if (report.report_status === "debug" || report.mock_generated) {
    return {
      label: "调试报告",
      cls: "conf-low",
      note: "由本地 mock 生成，用于开发调试。"
    };
  }
  if (report.report_status === "unratable") {
    return {
      label: "仅观察反馈",
      cls: "conf-low",
      note: report.human_review_reason?.includes("采样")
        ? "采样分歧过大，保留为观察记录。"
        : "本次未形成可评分证据（如单轮计时结束），保留为观察记录。"
    };
  }
  if (report.report_status === "provisional") {
    return {
      label: "观察性反馈",
      cls: "conf-mid",
      note: "部分维度证据不足，参考指数供发展反馈。"
    };
  }
  return {
    label: "本次观察结果",
    cls: "conf-high",
    note: "已通过采样与覆盖检查。"
  };
}

function scoringFailureReason(report: Report) {
  return report.scoring_error_reason ?? report.reason ?? report.human_review_reason ?? "评分服务暂时不可用，请稍后重试。";
}

function observationTitle(text: string | undefined | null) {
  const value = typeof text === "string" ? text : "";
  return value.length > 24 ? `${value.slice(0, 24)}…` : value;
}

/** Scroll-reveal wrapper: adds `.in` via IntersectionObserver when entering the viewport. */
function Reveal({
  className,
  style,
  children
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={className} data-reveal style={style}>
      {children}
    </div>
  );
}

export function ReportPage() {
  const { sessionId } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sceneTitle, setSceneTitle] = useState<string | null>(null);
  useSpotlight();

  useEffect(() => {
    if (!sessionId) return;
    getReport(sessionId)
      .then(setReport)
      .catch((err: Error) => setError(err.message));
    getSession(sessionId)
      .then((detail) => setSceneTitle(detail.scenario.title))
      .catch(() => {});
  }, [sessionId]);

  if (error) {
    return (
      <main className="wrap page">
        <p className="error-box">{error}</p>
        <Link to="/scenarios" className="btn btn-ghost">
          返回场景列表
        </Link>
      </main>
    );
  }

  if (!report) {
    return <main className="wrap page loading">正在生成观察报告…</main>;
  }

  if (report.report_status === "scoring_failed") {
    return <ScoringFailedView report={report} />;
  }

  return <ReportBody report={report} sceneTitle={sceneTitle} />;
}

function ScoringFailedView({ report }: { report: Report }) {
  const status = statusMeta(report);
  return (
    <main className="wrap page">
      <section className="report-hero">
        <Reveal>
          <span className="kicker">Behavior Observation</span>
        </Reveal>
        <Reveal style={{ "--d": ".08s" } as CSSProperties}>
          <h2 className="h2">评分服务暂时不可用</h2>
        </Reveal>
        <Reveal style={{ "--d": ".14s" } as CSSProperties}>
          <p className="muted">{scoringFailureReason(report)}</p>
        </Reveal>
        <Reveal style={{ "--d": ".2s" } as CSSProperties}>
          <div className={`conf ${status.cls}`}>{status.label}</div>
        </Reveal>
        <Reveal style={{ "--d": ".26s" } as CSSProperties}>
          <p className="small muted">{status.note}</p>
        </Reveal>
        <Reveal style={{ "--d": ".32s" } as CSSProperties}>
          <Link to="/scenarios" className="btn btn-ghost" style={{ marginTop: 16, display: "inline-flex" }}>
            返回场景列表
          </Link>
        </Reveal>
      </section>
    </main>
  );
}

function ReportBody({ report, sceneTitle }: { report: Report; sceneTitle: string | null }) {
  const dimsReveal = useReveal<HTMLDivElement>();
  const total = Number.isFinite(report.total_score) ? report.total_score : null;
  const decimals = total !== null && !Number.isInteger(total) ? 1 : 0;
  const { ref: scoreRef, text: scoreText } = useCountUp(total ?? 0, decimals);

  const conf = report.sampling_stats ? confidenceLevel(report.sampling_stats.variance) : null;
  const status = statusMeta(report);
  const sortedDims = Object.entries(report.dimension_scores).sort((a, b) => b[1] - a[1]);
  const dimKeys = Object.keys(report.dimension_scores);
  const maxScore = dimKeys.length * 20;
  const calibrationIssues = report.calibration_issues ?? [];
  const reviewReasons = [report.human_review_reason, ...calibrationIssues].filter(Boolean);
  const coverage = report.coverage_status;
  const coveredCount = coverage?.covered_dimensions?.length ?? 0;
  const totalCoverageCount = coverage
    ? (coverage.covered_dimensions?.length ?? 0) + (coverage.insufficient_dimensions?.length ?? 0)
    : 0;
  const formalScore = report.report_status === "confident" && !report.mock_generated;
  const heroTitle = sceneTitle ?? "本次评估";

  return (
    <main className="wrap page">
      <section className="report-hero">
        <Reveal>
          <span className="kicker">Behavior Observation</span>
        </Reveal>
        <Reveal style={{ "--d": ".08s" } as CSSProperties}>
          <h2 className="h2">{heroTitle} · 观察报告</h2>
        </Reveal>
        <Reveal style={{ "--d": ".16s" } as CSSProperties}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <span className={`conf ${status.cls}`}>{status.label}</span>
            {conf ? (
              <span className={`conf ${conf.cls}`}>{conf.label} · σ²={report.sampling_stats!.variance}</span>
            ) : null}
            {coverage ? (
              <span className={`conf ${coverage.complete ? "conf-high" : "conf-mid"}`}>
                观察点覆盖 {coveredCount}/{totalCoverageCount}
              </span>
            ) : null}
            <span className="chip">{report.level}</span>
          </div>
        </Reveal>
        <Reveal style={{ "--d": ".22s" } as CSSProperties}>
          <p className="muted">{status.note}</p>
          {reviewReasons.length ? <p className="small muted">{reviewReasons.join(" · ")}</p> : null}
        </Reveal>
        <Reveal style={{ "--d": ".28s" } as CSSProperties}>
          <Link to="/scenarios" className="btn btn-gold" style={{ marginTop: 20, display: "inline-flex" }}>
            重新评估
          </Link>
        </Reveal>
      </section>

      <div className="report-grid">
        <Reveal className="glass radar-card" style={{ "--d": ".2s" } as CSSProperties}>
          <RadarChart data={report.radar_chart_data} />
          <div className={`score-big ${formalScore ? "" : "score-big-muted"}`}>
            <span className="v" ref={scoreRef}>{total === null ? "–" : scoreText}</span>
            <span className="c">
              参考指数 / {maxScore}
              <br />
              {dimKeys.length} 个维度加权
            </span>
          </div>
        </Reveal>

        <div className="report-side">
          <Reveal className="glass" style={{ padding: 28, "--d": ".28s" } as CSSProperties}>
            <div className="sec-title">维度得分</div>
            <div className="dims" ref={dimsReveal}>
              {sortedDims.map(([key, value], i) => (
                <div className="dim" key={key}>
                  <div className="name">{getDimensionLabel(key)}</div>
                  <div className="track">
                    <div className="fill" style={{ "--w": `${Math.round((value / 20) * 100)}%`, "--d": `${i * 0.06}s` } as CSSProperties} />
                  </div>
                  <div className="val">{value}/20</div>
                </div>
              ))}
            </div>
          </Reveal>

          <div>
            <Reveal>
              <div className="sec-title">行为观察</div>
            </Reveal>
            <div className="obs">
              {report.evidence.length ? (
                report.evidence.map((item, i) => (
                  <Reveal key={i} className="glass obs-item spot" style={{ "--d": `${0.1 + i * 0.08}s` } as CSSProperties}>
                    <h4>
                      {observationTitle(item.quote || item.analysis)}
                      <span className="tagd">{getDimensionLabel(item.dimension)}</span>
                    </h4>
                    <p>{item.analysis || item.quote}</p>
                  </Reveal>
                ))
              ) : (
                <p className="muted small">暂无观察记录。</p>
              )}
            </div>
          </div>

          {report.sampling_stats ? (
            <Reveal className="glass" style={{ padding: 28, "--d": ".2s" } as CSSProperties}>
              <div className="sec-title">采样一致性</div>
              <div className="confidence-strip" aria-label="采样一致性">
                <div className="confidence-scores">
                  {report.sampling_stats.scores.map((s, i) => (
                    <span key={i} className="confidence-score-chip">{s}</span>
                  ))}
                </div>
                <div className="confidence-bar">
                  <div
                    className={`confidence-bar-fill ${conf!.cls}`}
                    style={{ width: `${Math.min(100, (report.sampling_stats.variance / 120) * 100)}%` }}
                  />
                </div>
                <span className="small muted">五次采样 · σ²={report.sampling_stats.variance}</span>
              </div>
            </Reveal>
          ) : null}

          {coverage ? (
            <Reveal className="glass" style={{ padding: 28, "--d": ".24s" } as CSSProperties}>
              <div className="sec-title">观察点覆盖</div>
              <div className="coverage-strip">
                <div>
                  <strong>已观察维度</strong>
                  <span>{coverage.covered_dimensions.length ? coverage.covered_dimensions.map(getDimensionLabel).join("、") : "暂无"}</span>
                </div>
                <div>
                  <strong>证据不足维度</strong>
                  <span>{coverage.insufficient_dimensions.length ? coverage.insufficient_dimensions.map(getDimensionLabel).join("、") : "无"}</span>
                </div>
              </div>
            </Reveal>
          ) : null}

          <Reveal style={{ "--d": ".1s" } as CSSProperties}>
            <div className="sec-title">维度分析</div>
            <div className="dim-analysis-grid">
              {Object.entries(report.dimension_analysis).map(([key, analysis]) => (
                <article className="dim-analysis-card" key={key}>
                  <span className="dim-analysis-label">{getDimensionLabel(key)}</span>
                  <p>{analysis}</p>
                </article>
              ))}
            </div>
          </Reveal>

          <Reveal style={{ "--d": ".16s" } as CSSProperties}>
            <div className="report-copy">
              <ReportSection title="能力优势" items={report.strengths} />
              <ReportSection title="发展风险" items={report.risks} />
              <ReportSection title="改进建议" items={report.suggestions} />
            </div>
          </Reveal>

          <Reveal style={{ "--d": ".2s" } as CSSProperties}>
            <div className="sec-title">关键证据</div>
            <div className="evidence-grid">
              {report.evidence.length ? (
                report.evidence.map((item, i) => (
                  <Reveal key={i} className="evidence-card" style={{ "--d": `${0.1 + i * 0.08}s` } as CSSProperties}>
                    <span className="evidence-dim-tag">{getDimensionLabel(item.dimension)}</span>
                    <blockquote>{item.quote}</blockquote>
                    <p>{item.analysis}</p>
                  </Reveal>
                ))
              ) : (
                <p className="muted small">暂无关键证据。</p>
              )}
            </div>
          </Reveal>

          <Reveal className="glass final-card" style={{ "--d": ".26s" } as CSSProperties}>
            <h3>下一步建议</h3>
            <p>{report.final_recommendation}</p>
          </Reveal>
        </div>
      </div>
    </main>
  );
}
