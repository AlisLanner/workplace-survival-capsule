import { useEffect, useState, type CSSProperties } from "react";
import { getDashboard } from "../../api/admin.api";
import { getDimensionLabel } from "../../config/dimensions";
import { useCountUp } from "../../hooks/useCountUp";
import { useReveal } from "../../hooks/useReveal";
import type { DashboardData } from "../../types/admin";

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const total = useCountUp(data?.total_sessions ?? 0);
  const running = useCountUp(data?.running_sessions ?? 0);
  const completed = useCountUp(data?.completed_sessions ?? 0);
  const average = useCountUp(data?.average_score ?? 0, 1);

  const totalCardReveal = useReveal<HTMLDivElement>();
  const runningCardReveal = useReveal<HTMLDivElement>();
  const completedCardReveal = useReveal<HTMLDivElement>();
  const averageCardReveal = useReveal<HTMLDivElement>();
  const barsCardReveal = useReveal<HTMLDivElement>();
  const barsReveal = useReveal<HTMLDivElement>();

  return (
    <>
      <div className="admin-heading">
        <span className="kicker">Admin · Dashboard</span>
        <h2 className="h2">仪表盘</h2>
      </div>
      {error ? <p className="error-box">{error}</p> : null}

      <div className="stats">
        <div className="glass stat" data-reveal ref={totalCardReveal} style={{ "--d": ".05s" } as CSSProperties}>
          <div className="k">总会话</div>
          <div className="v">{data ? <span ref={total.ref}>{total.text}</span> : "-"}</div>
        </div>
        <div className="glass stat hot" data-reveal ref={runningCardReveal} style={{ "--d": ".1s" } as CSSProperties}>
          <div className="k">进行中</div>
          <div className="v">{data ? <span ref={running.ref}>{running.text}</span> : "-"}</div>
        </div>
        <div className="glass stat" data-reveal ref={completedCardReveal} style={{ "--d": ".15s" } as CSSProperties}>
          <div className="k">已完成</div>
          <div className="v">{data ? <span ref={completed.ref}>{completed.text}</span> : "-"}</div>
        </div>
        <div className="glass stat" data-reveal ref={averageCardReveal} style={{ "--d": ".2s" } as CSSProperties}>
          <div className="k">评分统计</div>
          <div className="v">
            按情境及版本分组
          </div>
        </div>
      </div>

      {(data?.groups??[]).map(group=><section className="glass" key={group.scenario_id+group.assessment_version+group.model_config} style={{padding:24,marginBottom:20}}><h3>{group.scenario_id} · {group.assessment_version}</h3><p className="small muted">有效完整非模拟报告 {group.count} 份 · 平均总分 {group.average_score} / 160</p><details><summary>模型配置</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{group.model_config}</pre></details><div className="dbars">{Object.entries(group.average_dimension_scores).map(([name,value])=><p key={name}>{name}：{value} / 20</p>)}</div></section>)}

      <div className="glass" data-reveal ref={barsCardReveal} style={{ padding: "28px", "--d": ".25s" } as CSSProperties}>
        <div className="sec-title">统计口径</div>
        <p className="muted">仅纳入同一情境、测量版本及实际模型配置的完整非模拟报告。缺失、评分失败、待复核和旧版演示不与新版混合计算。</p>
        <div className="dbars" ref={barsReveal}>
          {Object.entries(data?.average_dimension_scores ?? {}).map(([key, value], i) => {
            const percent = Math.min(100, Math.round((value / 20) * 100));

            return (
              <div className="dbar" key={key}>
                <span className="name">{getDimensionLabel(key)}</span>
                <div className="track">
                  <div className="fill" style={{ "--w": `${percent}%`, "--d": `${i * 0.06}s` } as CSSProperties} />
                </div>
                <span className="val">{value}/20</span>
              </div>
            );
          })}
          {data && !Object.keys(data.average_dimension_scores).length ? <p className="muted">暂无已完成会话。</p> : null}
        </div>
      </div>
    </>
  );
}
