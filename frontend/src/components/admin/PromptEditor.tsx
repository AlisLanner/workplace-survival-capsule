import { useState } from "react";
import type { PromptTemplate } from "../../types/admin";

export function PromptEditor({
  prompt,
  onSave
}: {
  prompt: PromptTemplate;
  onSave: (key: string, data: { content: string; name: string; active: boolean }) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: prompt.name,
    content: prompt.content,
    active: prompt.active
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(prompt.key, draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="glass prompt spot">
      <div className="prompt-top">
        <div>
          <span className="k">{prompt.key}</span>
          <span className="ver">v{prompt.version}</span>
        </div>
        <label className={`switch${draft.active ? " on" : ""}`} title={draft.active ? "启用中" : "已停用"}>
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
            aria-label="启用"
          />
        </label>
      </div>
      <div className="nm">{draft.name}</div>
      <pre>{draft.content}</pre>
      <details>
        <summary>编辑</summary>
        <div className="admin-form">
          <label className="f-label">
            名称
            <input
              className="f-input"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="f-label">
            内容
            <textarea
              className="f-textarea"
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            />
          </label>
          <button className="btn btn-gold" onClick={save} disabled={saving}>
            {saving ? "保存中" : "保存"}
          </button>
        </div>
      </details>
    </article>
  );
}
