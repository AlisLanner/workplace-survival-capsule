"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, FileCode2, Braces } from "lucide-react";
import { listPrompts, updatePrompt } from "@/lib/api";
import type { PromptTemplate } from "@/lib/types";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";

/** 提示词管理（正式数据）：真实模板与版本；版本模板保存即产生新修订。 */
export function AdminPrompts() {
  const [prompts, setPrompts] = useState<PromptTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  async function load() { setPrompts(await listPrompts()); }
  useEffect(() => { load().catch(err => setError(err instanceof Error ? err.message : "读取失败")); }, []);
  const grouped = useMemo(() => {
    if (!prompts) return [] as Array<{ key: string; label: string; items: PromptTemplate[] }>;
    const groups = new Map<string, PromptTemplate[]>();
    for (const prompt of prompts) {
      const group = prompt.key.startsWith("ge8-") ? "ge8" : "legacy";
      groups.set(group, [...(groups.get(group) ?? []), prompt]);
    }
    return [...groups.entries()].map(([key, items]) => ({ key, label: key === "ge8" ? "统一八维版本模板" : "旧版流程模板", items }));
  }, [prompts]);
  if (error && !prompts) return <div className="rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-8 text-center text-[12px] text-rose-200/80" role="alert">{error}</div>;
  if (!prompts) return <div className="grid h-[240px] place-items-center text-[11px] text-slate-600" role="status">正在读取提示词模板…</div>;
  async function save(key: string) {
    setSaving(key); setError(null); setNote(null);
    try {
      await updatePrompt(key, { content: drafts[key] ?? "" });
      setNote(`已保存 ${key} 的修订。`);
      await load(); setExpanded(null);
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败"); } finally { setSaving(null); }
  }
  return <div className="grid gap-7">
    {(error || note) ? <p className={cn("rounded-lg border px-4 py-3 text-[11px]", error ? "border-rose-300/20 bg-rose-300/[.04] text-rose-200/85" : "border-sky-100/15 bg-sky-100/[.04] text-sky-100/75")} role="status">{error ?? note}</p> : null}
    {grouped.map(group => <section key={group.key}>
      <h3 className="mb-3 flex items-center gap-2 text-[12px] font-normal text-slate-300"><Braces className="size-3.5 text-slate-600" />{group.label}<span className="font-mono text-[9px] text-slate-700">{group.items.length} 项</span></h3>
      <div className="divide-y divide-white/[.05] rounded-xl border border-white/[.065] bg-slate-900/15">
        {group.items.map(prompt => <div key={prompt.id}>
          <button onClick={() => { setExpanded(expanded === prompt.key ? null : prompt.key); if (!(prompt.key in drafts)) setDrafts(previous => ({ ...previous, [prompt.key]: prompt.content })); }} className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left outline-offset-4 transition-colors hover:bg-white/[.015]" aria-expanded={expanded === prompt.key}>
            <span className="min-w-0"><span className="block truncate text-[11.5px] text-slate-200">{prompt.name}</span><span className="mt-1 block truncate font-mono text-[9px] text-slate-600">{prompt.key} · v{prompt.version}</span></span>
            <span className="flex shrink-0 items-center gap-3"><span className={cn("rounded-full border px-2 py-0.5 text-[8px]", prompt.active ? "border-emerald-100/20 bg-emerald-100/[.04] text-emerald-100/70" : "border-white/10 text-slate-600")}>{prompt.active ? "启用" : "停用"}</span><FileCode2 className="size-3.5 text-slate-600" /></span>
          </button>
          {expanded === prompt.key ? <div className="border-t border-white/[.05] px-5 py-4">
            <p className="mb-2.5 text-[9px] leading-5 text-slate-600">直接编辑正文并保存；版本模板（ge8- 前缀）保存会生成新修订，运行中的会话沿用开始时的冻结快照。</p>
            <Textarea rows={12} value={drafts[prompt.key] ?? prompt.content} onChange={event => setDrafts(previous => ({ ...previous, [prompt.key]: event.target.value }))} className="font-mono text-[11px] leading-6" aria-label={`${prompt.name} 正文`} />
            <div className="mt-3 flex items-center gap-2.5">
              <Button onClick={() => void save(prompt.key)} disabled={saving === prompt.key} className="gap-2 bg-slate-200 text-[10px] font-normal text-slate-950 hover:bg-white disabled:opacity-60"><Check className="size-3" />{saving === prompt.key ? "保存中…" : "保存修订"}</Button>
              <Button variant="ghost" onClick={() => { setDrafts(previous => ({ ...previous, [prompt.key]: prompt.content })); setExpanded(null); }} className="gap-2 text-[10px] font-normal text-slate-500"><RotateCcw className="size-3" />放弃修改</Button>
            </div>
          </div> : null}
        </div>)}
      </div>
    </section>)}
  </div>;
}
