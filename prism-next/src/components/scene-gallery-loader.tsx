"use client";
import { useEffect, useState } from "react";
import { listScenarios } from "@/lib/api";
import { toSceneEntries } from "@/lib/scene-profiles";
import { SceneGallery } from "./scene-gallery";

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
  return <SceneGallery entries={entries} />;
}
