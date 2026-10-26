"use client";
import { useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import { domains } from "@/lib/content";
import { Button } from "./ui/button";
import { useMotionPreferences } from "./app-shell";
import { cn } from "@/lib/utils";
export function FrameworkView(){
  const [index,setIndex]=useState(0),{enabled}=useMotionPreferences();const selected=domains[index];
  return <div style={{"--selected-tone":selected.tone} as CSSProperties}>
    <div className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr] lg:gap-20">
      <div className="relative mx-auto h-[290px] w-full max-w-[470px] [perspective:1000px] sm:h-[310px]">
        <div aria-hidden="true" className="absolute right-4 bottom-7 left-5 h-12 -rotate-10 rounded-full bg-[linear-gradient(90deg,#cf9d6a35,#abcba535,#89bbd83a,#af92cb35)] blur-2xl"/>
        <div className="absolute inset-x-2 top-7 bottom-7 flex -rotate-9 items-center justify-center gap-2.5 [transform-style:preserve-3d] sm:gap-3">
          {domains.map((domain,i)=><motion.button key={domain.name} type="button" onClick={()=>setIndex(i)} aria-label={domain.name} aria-pressed={i===index} animate={{y:i===index?-12:0,opacity:i===index?1:.55}} transition={{duration:enabled?.4:0}} whileHover={enabled?{y:-8,opacity:.85}:undefined} style={{"--tone":domain.tone,height:[180,203,224,239,239,224,203,180][i]} as CSSProperties} className={cn("relative w-[28px] cursor-pointer rounded-[3px] border border-[var(--tone)]/20 bg-[linear-gradient(110deg,color-mix(in_srgb,var(--tone)_14%,transparent),color-mix(in_srgb,var(--tone)_5%,transparent)_40%,color-mix(in_srgb,var(--tone)_24%,transparent))] shadow-[inset_1px_0_0_color-mix(in_srgb,var(--tone)_24%,transparent)] outline-offset-6 focus-visible:outline-1 focus-visible:outline-slate-200 sm:w-[34px]",i===index&&"border-[var(--tone)]/55 shadow-[0_0_32px_color-mix(in_srgb,var(--tone)_12%,transparent)]")}><span className="absolute inset-x-2 inset-y-0 bg-gradient-to-b from-transparent via-[var(--tone)]/10 to-transparent blur-sm"/><span className="absolute right-0 bottom-3 left-0 font-mono text-[7px] text-[var(--tone)]/60">{String(i+1).padStart(2,"0")}</span></motion.button>)}
        </div><p className="absolute right-0 bottom-0 left-0 text-center font-mono text-[7px] tracking-[.25em] text-slate-600">ONE SPECTRUM · EIGHT PERSPECTIVES</p>
      </div>
      <div className="min-h-[270px] max-w-[420px] py-2"><p className="font-mono text-[10px] tracking-[.18em] text-[var(--selected-tone)]">{String(index+1).padStart(2,"0")} / 08</p><AnimatePresence mode="wait" initial={false}><motion.div key={index} initial={enabled?{opacity:.3,y:5}:false} animate={{opacity:1,y:0}} exit={{opacity:.3,y:-3}} transition={{duration:enabled?.17:0}}><h2 className="mt-5 text-[35px] font-normal tracking-[-.04em] text-slate-100">{selected.name}</h2><p className="mt-5 min-h-[60px] text-[13px] leading-8 text-slate-400">{selected.description}</p></motion.div></AnimatePresence><div className="mt-6 h-px w-16 bg-gradient-to-r from-[var(--selected-tone)]/60 to-transparent"/><p className="mt-4 text-[9px] text-slate-600">评价领域 / Great Eight 胜任力框架</p><Button variant="ghost" onClick={()=>setIndex((index+1)%8)} className="-ml-4 mt-3 gap-8 text-[10px] font-normal text-slate-400 hover:bg-white/[.025]">下一能力领域<ArrowRight className="size-3.5"/></Button></div>
    </div>
    <div className="mt-7 grid grid-cols-2 gap-x-6 md:mt-9 md:grid-cols-4 md:gap-x-9">{domains.map((domain,i)=><button key={domain.name} aria-pressed={index===i} onClick={()=>setIndex(i)} className={cn("relative flex cursor-pointer items-center gap-4 border-b border-white/[.055] py-4 text-left text-[11px] outline-offset-4 transition-colors hover:text-slate-200 focus-visible:outline-1 focus-visible:outline-sky-100",index===i?"text-slate-100":"text-slate-500")}><span className="font-mono text-[8px] text-slate-600">{String(i+1).padStart(2,"0")}</span>{domain.name}{index===i&&<motion.span layoutId="domain-indicator" className="absolute right-0 bottom-0 left-0 h-px bg-[var(--selected-tone)]/60" transition={{duration:enabled?.25:0}}/>}</button>)}</div>
  </div>;
}
