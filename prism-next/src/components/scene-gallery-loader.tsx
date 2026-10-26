"use client";
import { useEffect, useState } from "react";
import { listScenarios } from "@/lib/api";
import { toSceneEntries } from "@/lib/scene-profiles";
import { SceneGallery } from "./scene-gallery";
import { TransitionLink as Link } from "./transition-link";
import { ArrowUpRight } from "lucide-react";

export function SceneGalleryLoader() {
  const [entries, setEntries] = useState<ReturnType<typeof toSceneEntries> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listScenarios()
      .then(scenarios => setEntries(toSceneEntries(scenarios)))
      .catch(err => setError(err instanceof Error ? err.message : "情境读取失败"));
  }, []);
  if (error) return <div className="rounded-xl border border-rose-300/20 bg-rose-300/[.04] px-5 py-10 text-center text-[12px] text-rose-200/80" role="alert">{error}</div>;
  if (!entries) return <div className="grid h-[320px] place-items-center text-[11px] text-slate-600" role="status">正在读取启用中的情境…</div>;
  if (!entries.length) return <div className="rounded-xl border border-dashed border-white/10 py-16 text-center text-[12px] text-slate-600">当前没有启用中的情境。</div>;
  const order = ["A", "B", "C", "E"];
  const core = entries.filter(entry => order.includes(entry.key)).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const custom = entries.filter(entry => !order.includes(entry.key) && entry.key !== "D");
  const legacy = entries.find(entry => entry.key === "D");
  return <div>
    {core.length ? <SceneGallery entries={core} /> : null}
    {custom.length ? <section aria-label="其他启用情境" className="mt-10 border-t border-white/[.06] pt-6">
      <h2 className="mb-4 text-[13px] font-normal text-slate-400">其他启用情境</h2>
      <div className="grid gap-3 sm:grid-cols-2">{custom.map(entry => <Link key={entry.key} href={`/scenarios/${entry.key}`} className="group flex items-center justify-between gap-5 rounded-xl border border-white/[.08] bg-white/[.015] px-5 py-4 transition-colors hover:border-white/20 hover:bg-white/[.035]">
        <span><span className="block text-[14px] text-slate-200">{entry.scenario.title}</span><span className="mt-1.5 block text-[11px] text-slate-500">{entry.scene.category}{entry.scene.role ? ` · ${entry.scene.role}` : ""}</span></span><ArrowUpRight className="size-4 shrink-0 text-slate-500 group-hover:text-slate-200" />
      </Link>)}</div>
    </section> : null}
    {legacy ? <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/[.045] pt-5 text-[11px]">
      <Link href="/scenarios/D" className="flex items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-200">旧版演示 · {legacy.scenario.title}<ArrowUpRight className="size-3" /></Link><span className="text-slate-600">旧版结果单独解释</span>
    </div> : null}
  </div>;
}
