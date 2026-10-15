import { useEffect, useState } from "react";
import { listPrompts, updatePrompt } from "../../api/admin.api";
import { PromptEditor } from "../../components/admin/PromptEditor";
import type { PromptTemplate } from "../../types/admin";

export function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setPrompts(await listPrompts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(key: string, data: { content: string; name: string; active: boolean }) {
    await updatePrompt(key, data);
    await load();
  }

  return (
    <>
      <div className="admin-heading">
        <span className="kicker">Prompt Lab</span>
        <h2 className="h2">提示词管理</h2>
      </div>
      {error ? <p className="error-box">{error}</p> : null}
      <div className="prompt-list">
        {prompts.map((prompt) => (
          <PromptEditor key={prompt.key} prompt={prompt} onSave={save} />
        ))}
      </div>
    </>
  );
}
