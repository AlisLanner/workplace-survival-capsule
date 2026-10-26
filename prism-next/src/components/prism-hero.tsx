"use client";
import { TransitionLink as Link } from "@/components/transition-link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { createPrismCanvas, type PrismCanvasController } from "@/lib/prism-canvas";
import { useMotionPreferences } from "./app-shell";
import { cn } from "@/lib/utils";
export function PrismHero(){
  const root=useRef<HTMLDivElement>(null),visual=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),image=useRef<HTMLImageElement>(null),controller=useRef<PrismCanvasController|null>(null);
  const [ready,setReady]=useState(false),{enabled}=useMotionPreferences();
  useEffect(()=>{if(!root.current||!visual.current||!canvas.current||!image.current)return;controller.current=createPrismCanvas(root.current,visual.current,canvas.current,image.current,enabled,()=>setReady(true));return()=>{controller.current?.destroy();controller.current=null;};},[]);
  useEffect(()=>controller.current?.setMotion(enabled),[enabled]);
  return <div ref={root} className="relative isolate h-[calc(100dvh-106px)] min-h-[535px] overflow-hidden bg-[#030303] pt-6 text-center md:pt-7">
    <canvas ref={canvas} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full saturate-[1.35] brightness-110 transition-opacity duration-700",ready?"opacity-100":"opacity-0")}/>
    <div ref={visual} role="img" aria-label="朦胧的文字在玻璃棱镜中变得清晰，暖白日光向右折射成带细微颗粒的彩虹雾" className="relative h-[300px] sm:h-[330px] md:h-[340px]"><div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-700",ready?"opacity-0":"opacity-100")}><span className="text-[110px] tracking-widest text-white/15 blur-[6px] sm:text-[170px]">MAAT</span><img ref={image} src="/prism.webp" alt="" width="330" height="330" className="absolute w-[min(330px,79vw)] object-contain brightness-75"/></div></div>
    <div className="relative z-10 px-5"><h1 className="text-[24px] font-normal leading-snug tracking-[-.02em] text-slate-100 md:text-[29px]">看见能力的不同侧面。</h1><p className="mt-4 text-[11px] leading-7 tracking-wide text-slate-400 md:text-[12px]">看清每一份表现，发现尚未被看见的潜能。</p></div>
    <Link href="/scenarios" className="absolute bottom-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-8 rounded-full border border-sky-200/45 bg-sky-300/[.12] px-6 py-3 text-[13px] text-sky-100 outline-offset-5 transition-colors hover:border-sky-100/70 hover:bg-sky-300/20 hover:text-white focus-visible:outline-1 focus-visible:outline-sky-100">走进情境<ArrowUpRight className="size-4" strokeWidth={1.3}/></Link>
  </div>;
}
