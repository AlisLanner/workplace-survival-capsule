import type { Scene } from "@/lib/content";
import { SceneArt } from "./scene-art";

/** The final cover is shared with the moving card, so landing has no visual swap. */
export function ScenarioCover({ scene, bridge = false }: { scene: Scene; bridge?: boolean }) {
  const Heading = bridge ? "div" : "h1";
  return <div data-scenario-cover={bridge ? undefined : scene.code} className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,#1b2735,#0b131e)] shadow-[0_24px_65px_#0006]">
    <div className="relative aspect-[1.4]"><SceneArt scene={scene} idPrefix={bridge ? "bridge-detail" : "detail"} /><div className="absolute top-5 left-6 font-mono text-[10px] tracking-widest text-slate-300/60">SCENARIO / {scene.code}</div></div>
    <div className="px-7 pt-6 pb-7"><div className="text-[10px] tracking-widest text-slate-500">{scene.category}</div><Heading className="mt-4 text-[29px] font-normal leading-[1.45] tracking-tight text-slate-100">{scene.line1}<br />{scene.line2}</Heading><p className="mt-5 text-[11px] leading-7 text-slate-500">{scene.prompt}</p></div>
  </div>;
}
