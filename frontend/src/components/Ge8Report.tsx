import type { Message, Report } from "../types/assessment";
import { RadarChart } from "./RadarChart";

const labels={rated:"已评分",not_observed:"未观察",insufficient:"证据不足",scoring_failed:"评分失败"};
export function Ge8Report({report,messages=[]}:{report:Report;messages?:Message[]}) {
  const dims=report.dimension_results??[];
  const complete=dims.length===8 && dims.every(d=>d.status==="rated" && d.score!==null);
  const stable=report.report_status==="confident";
  return <div className="ge8-report">
    <section className="glass" style={{padding:24,marginBottom:24}}>
      <h2>统一八维行为观察</h2>
      <p className="small muted">测量版本 {report.assessment_version} · {report.mock_generated?"模拟调试":stable?"评分稳定性检查通过":"建议复核"}</p>
      <p>{report.summary}</p>
      <p><strong>{report.total_score===null?"未形成完整总分":`${report.total_score} / 160`}</strong></p>
      <p className="muted">总分仅为本情境描述性汇总；不同情境、新旧版本不直接比较，不设招聘淘汰线。</p>
      {report.review_reasons?.length?<p className="small">复核原因：{report.review_reasons.join("；")}</p>:null}
      {complete?<div style={{maxWidth:460,margin:"0 auto"}}><RadarChart data={dims.map(d=>({name:d.name,score:d.score!,max:20}))}/></div>:<p className="muted">存在未评分维度，暂不绘制完整雷达图。</p>}
      {typeof report.sampling_stats?.variance==="number"?<p className="small muted">五次评分总分方差 {report.sampling_stats.variance}。重复评分稳定性不代表测量效度。</p>:null}
    </section>
    <div className="ge8-dimensions">
      {dims.map(dim=><section className="glass" key={dim.id} style={{padding:24,minWidth:0}}>
        <h3>{dim.name} <span className="chip">{dim.score===null?labels[dim.status]:`${dim.score} / 20`}</span></h3>
        <p>{dim.analysis}</p>
        {dim.slot_results.map(slot=><div key={slot.slot_id} className="ge8-slot">
          <p className="small muted">观察点 {slot.slot_id.split(":").at(-1)} · {slot.sufficiency==="sufficient"?"可判断":slot.sufficiency==="partial"?"仍需补充":"未形成证据"} · 实际机会 {slot.opportunity.length}</p>
          {slot.evidence.map((e,i)=><blockquote key={e.message_id+i}><a href={`#message-${e.message_id}`}>“{e.quote}”</a><p className="small muted">{e.reason}</p></blockquote>)}
          {!slot.evidence.length?<p className="small muted">无可定位原话，保留缺失。</p>:null}
        </div>)}
      </section>)}
    </div>
    {messages.length?<section className="glass" style={{padding:24,marginTop:24}}><h3>本次对话依据</h3>{messages.map(m=><article key={m.id} id={`message-${m.id}`} className="ge8-message"><p className="small muted">第 {m.roundIndex} 轮 · {m.senderName}</p><p style={{whiteSpace:"pre-wrap"}}>{m.content}</p></article>)}</section>:null}
    <p className="muted" style={{marginTop:24}}>{report.final_recommendation}</p>
  </div>;
}
