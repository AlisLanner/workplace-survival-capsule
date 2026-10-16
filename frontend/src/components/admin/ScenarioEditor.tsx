import { useState } from "react";
import type { Scenario } from "../../types/assessment";

export function ScenarioEditor({
  scenario,
  onSave
}: {
  scenario: Scenario;
  onSave: (data: Partial<Scenario>) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    title: scenario.title,
    description: scenario.description,
    backgroundForUser: scenario.backgroundForUser,
    maxRound: scenario.maxRound,
    groupChatEnabled: scenario.groupChatEnabled,
    groupChatRounds: JSON.stringify(scenario.groupChatRounds),
    status: scenario.status
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if(scenario.assessmentVersion)return <article className="glass" style={{padding:24}}><h3>{scenario.title}</h3><p className="small muted">{scenario.assessmentVersion} · 任务内容已冻结，变更须安装新测量版本。</p><p style={{whiteSpace:"pre-wrap"}}>{scenario.backgroundForUser}</p></article>;

  function parseGroupChatRounds() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft.groupChatRounds);
    } catch {
      throw new Error("群聊轮次必须是数字数组，例如 [3,6,9]。");
    }

    if (!Array.isArray(parsed) || parsed.some((item) => !Number.isInteger(item) || item < 1)) {
      throw new Error("群聊轮次必须是正整数数组，例如 [3,6,9]。");
    }

    return parsed;
  }

  async function save() {
    setError(null);
    let groupChatRounds: number[];
    try {
      groupChatRounds = parseGroupChatRounds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "群聊轮次格式无效。");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...draft,
        maxRound: Number(draft.maxRound),
        groupChatEnabled: Boolean(draft.groupChatEnabled),
        groupChatRounds
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="glass">
      <div className="admin-form">
        <label className="f-label">
          标题
          <input
            className="f-input"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <label className="f-label">
          描述
          <textarea
            className="f-textarea"
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </label>
        <label className="f-label">
          用户背景
          <textarea
            className="f-textarea"
            value={draft.backgroundForUser}
            onChange={(event) => setDraft({ ...draft, backgroundForUser: event.target.value })}
          />
        </label>
        <label className="f-label">
          最大轮次
          <input
            className="f-input"
            type="number"
            value={draft.maxRound}
            onChange={(event) => setDraft({ ...draft, maxRound: Number(event.target.value) })}
          />
        </label>
        <label className="f-label">
          群聊轮次 JSON
          <input
            className="f-input"
            value={draft.groupChatRounds}
            onChange={(event) => setDraft({ ...draft, groupChatRounds: event.target.value })}
          />
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={draft.groupChatEnabled}
            onChange={(event) => setDraft({ ...draft, groupChatEnabled: event.target.checked })}
          />
          启用群聊机制
        </label>
        {error ? <p className="error-box" role="alert">{error}</p> : null}
        <button className="btn btn-gold" onClick={save} disabled={saving}>
          {saving ? "保存中" : "保存"}
        </button>
      </div>
    </article>
  );
}
