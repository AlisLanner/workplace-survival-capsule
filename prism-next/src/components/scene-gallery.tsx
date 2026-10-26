"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SceneArt } from "./scene-art";
import type { SceneEntry } from "@/lib/scene-profiles";
import { cn } from "@/lib/utils";
import { useMotionPreferences } from "./app-shell";
import { useRouteTransition } from "./route-transition";

/** 真实情境卡画廊：内置四卡沿用原散开/收拢动画；自定义情境按同一规则生成位置。 */
export function SceneGallery({ entries }: { entries: SceneEntry[] }) {
  const router=useRouter(),{enabled}=useMotionPreferences();
  const [selected,setSelected]=useState<string|null>(null);
  const action=useRef<string|null>(null);
  const {navigate,revision,epoch}=useRouteTransition();
  const choiceVersion=useRef(0);
  const covers=useRef<Record<string,HTMLDivElement|null>>({});
  const count=entries.length;
  useEffect(()=>{entries.forEach(entry=>router.prefetch(`/scenarios/${entry.key}`));},[router,entries]);
  useEffect(()=>{const cancel=(event:KeyboardEvent)=>{if(event.key==="Escape"&&action.current&&action.current!=="navigating"){action.current=null;setSelected(null);}};addEventListener("keydown",cancel);return()=>removeEventListener("keydown",cancel);},[]);
  useLayoutEffect(()=>{if(action.current&&action.current!=="navigating"&&choiceVersion.current!==revision.current){action.current=null;setSelected(null);}},[epoch,revision]);
  function choose(key:string){if(action.current)return;if(!enabled){void navigate(`/scenarios/${key}`);return;}choiceVersion.current=revision.current;action.current=key;setSelected(key);}
  function complete(key:string){if(action.current===key&&revision.current===choiceVersion.current){action.current="navigating";const source=covers.current[key];void navigate(`/scenarios/${key}`,source?{card:{code:key,source}}:undefined);}}
  const selectedIndex=entries.findIndex(entry=>entry.key===selected);
  return <div>
    <div aria-label="选择工作情境" className="relative mx-auto h-[690px] max-w-[1170px] [perspective:1600px] sm:h-[760px] md:h-[400px] lg:h-[425px]">
      {entries.map((entry,index)=>{
        const rank=selectedIndex<0?index:(index-selectedIndex+count)%count;
        const cardWidth=Math.min(235,Math.max(150,Math.floor(1100/Math.max(count,1))));
        const variables={"--spread-x":index%2===0?"25%":"75%","--spread-y":`${Math.floor(index/2)*350+12}px`,"--desktop-x":`${((index+0.5)/count)*100}%`,"--card-w":`${cardWidth}px`} as CSSProperties;
        return <motion.div layout={enabled} key={entry.key} onLayoutAnimationComplete={()=>complete(entry.key)} transition={{layout:{duration:.58,ease:[.22,.8,.2,1]}}} style={{...variables,zIndex:selected?count-rank:10+index}} className={cn("absolute w-[calc((100%_-_22px)/2)] max-w-[242px] -translate-x-1/2 [transform-style:preserve-3d] sm:w-[215px] lg:w-[var(--card-w)]",selected?"top-9 left-1/2":"top-[var(--spread-y)] left-[var(--spread-x)] md:top-9 md:left-[var(--desktop-x)]")}>
          <motion.div animate={{rotate:selected?(rank===0?0:rank*3):[-5,-1.8,1.8,5][index%4],y:selected?rank*8:[14,0,0,14][index%4],x:selected?rank*13:0,scale:selected?(rank===0?1.025:1-rank*.035):1,opacity:selected?(rank===0?1:Math.max(.2,.58-rank*.09)):1}} transition={{duration:enabled?.58:0,ease:[.22,.8,.2,1]}} whileHover={!selected&&enabled?{y:-9,rotate:0,transition:{duration:.26}}:undefined}>
            <button onClick={()=>choose(entry.key)} disabled={selected!==null} aria-label={`选择情境：${entry.scenario.title}`} aria-pressed={selected===entry.key} className="group block w-full cursor-pointer rounded-xl text-left outline-offset-6 focus-visible:outline-2 focus-visible:outline-sky-100 disabled:cursor-default">
              <Card ref={node=>{covers.current[entry.key]=node;}} className={cn("relative gap-0 overflow-hidden rounded-xl border-white/[.11] bg-[linear-gradient(145deg,#1a2431,#0c131d_70%)] py-0 shadow-[0_16px_40px_#0006] transition-[border-color,box-shadow] duration-300 group-hover:border-white/25 group-hover:shadow-[0_23px_50px_#0009]",selected===entry.key&&"border-slate-200/40")}>
                <div className="relative aspect-[1.6] overflow-hidden border-b border-white/[.07]"><SceneArt scene={entry.scene}/><span className="absolute top-4 left-4 font-mono text-[11px] tracking-[.22em] text-slate-300/55">{entry.key.length<=2?`${entry.key} / ${String(count).padStart(2,"0")}`:"情境"}</span><ArrowUpRight className="absolute top-4 right-4 size-3.5 text-slate-200/40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.25}/></div>
                <div className="px-4 pt-5 pb-5 sm:px-5"><div className="flex items-center gap-2 font-sans text-[11px] tracking-wider text-slate-500"><span className="size-1 rounded-full" style={{backgroundColor:entry.scene.tone}}/>{entry.scene.category}</div><h2 className="mt-3 text-[20px] font-normal leading-[1.35] tracking-[-.025em] text-slate-100 sm:text-[22px]">{entry.scene.line1}<br/>{entry.scene.line2}</h2><p className="mt-3 min-h-9 text-[12px] leading-[1.8] text-slate-500">{entry.scene.summary}</p><div className="mt-4 flex items-center justify-between border-t border-white/[.06] pt-3 text-[10px] text-slate-600"><span className="max-w-[75%] truncate">{entry.scene.role||entry.scenario.title}</span>{selected===entry.key?<Check className="size-3 text-sky-100/70"/>:<span className="font-mono tracking-[.12em]">{String(index+1).padStart(2,"0")}</span>}</div></div>
                <div aria-hidden="true" className="pointer-events-none absolute inset-[4px] rounded-[9px] border border-white/[.035]"/>
              </Card>
            </button>
          </motion.div>
        </motion.div>;
      })}
    </div>
    <div className="flex min-h-10 items-center justify-center pt-2 text-center text-[12px] leading-6 text-slate-500" aria-live="polite">{selected?`正在打开「${entries.find(entry=>entry.key===selected)?.scenario.title}」`:<span>选择一张情境卡，开始了解你的角色与任务。<span className="ml-3 hidden font-mono text-[10px] tracking-[.12em] text-slate-700 md:inline">CHOOSE A PERSPECTIVE</span></span>}</div>
  </div>;
}
