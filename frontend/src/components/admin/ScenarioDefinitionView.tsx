import { GE8_DIMENSIONS } from "../../config/dimensions";
import type { DimensionWeights, ScenarioDefinition } from "../../types/admin";

const AGENT_LABEL: Record<string, string> = { leader: "上级", coworker: "同级协作方", client: "利益相关方" };

export function ScenarioDefinitionView({
  definition,
  weights,
  warnings
}: {
  definition: ScenarioDefinition;
  weights: DimensionWeights;
  warnings?: string[];
}) {
  return (
    <div className="def-view">
      {warnings?.length ? (
        <div className="error-box">{warnings.map((w, i) => <p key={i}>{w}</p>)}</div>
      ) : null}
      <section className="glass def-section">
        <h3>① 基本信息</h3>
        <p><b>场景标题：</b>{definition.title}</p>
        <p><b>受测者角色：</b>{definition.user_role}</p>
        <p className="small muted">对话 {definition.round_policy.min}—{definition.round_policy.max} 轮 · 测量版本 {definition.assessment_version}</p>
      </section>
      <section className="glass def-section">
        <h3>② 三名对话角色</h3>
        {Object.entries(definition.roles).map(([agent, role]) => (
          <p key={agent}><b>{AGENT_LABEL[agent] ?? agent} {role.name}</b>：{role.role}</p>
        ))}
      </section>
      <section className="glass def-section">
        <h3>③ 公开事实（候选人可见）</h3>
        <ul>{definition.public_facts.map((f) => <li key={f.id}>{f.text}</li>)}</ul>
      </section>
      <section className="glass def-section">
        <h3>④ 角色私有事实（制造信息差）</h3>
        <ul>
          {Object.entries(definition.role_facts).flatMap(([agent, facts]) =>
            facts.map((f) => <li key={f.id}><b>{AGENT_LABEL[agent] ?? agent}</b>：{f.text}</li>)
          )}
        </ul>
      </section>
      <section className="glass def-section">
        <h3>⑤ 中途事件</h3>
        <ul>
          {definition.events.map((e) => (
            <li key={e.id}>第 {e.round} 轮 · {AGENT_LABEL[e.agent] ?? e.agent}（{definition.roles[e.agent]?.name}）：{e.facts[0]?.text}</li>
          ))}
        </ul>
      </section>
      <section className="glass def-section">
        <h3>⑥ 十六个观察点</h3>
        <div className="def-slots">
          {definition.slots.map((s) => {
            const dim = GE8_DIMENSIONS.find((d) => d.id === s.dimension_id);
            return (
              <div className="def-slot" key={s.slot_id}>
                <span className="chip">{s.display_code}</span>
                <div>
                  <p><b>{dim?.name ?? s.dimension_id}</b>（{AGENT_LABEL[s.target_agent] ?? s.target_agent}）：{s.observation}</p>
                  <p className="small muted">中性追问：{s.probe_intent}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="glass def-section">
        <h3>⑦ 八维权重</h3>
        <ul className="def-weights">
          {GE8_DIMENSIONS.map((d) => {
            const w = weights.weights?.[d.id as keyof typeof weights.weights] ?? 0.125;
            const imp = weights.importance?.[d.id as keyof typeof weights.importance];
            const free = weights.free_text?.[d.id as keyof typeof weights.free_text];
            return (
              <li key={d.id}>
                <b>{d.name}</b>：权重 {(w * 100).toFixed(1)}%{imp ? ` · 重要程度 ${imp}/5` : ""}{free ? ` · “${free}”` : ""}
              </li>
            );
          })}
        </ul>
        {weights.note ? <p className="small muted">{weights.note}</p> : null}
      </section>
    </div>
  );
}
