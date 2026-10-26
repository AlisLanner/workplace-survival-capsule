"use client";
import { TransitionLink as Link } from "@/components/transition-link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { navigation } from "@/lib/content";
import { cn } from "@/lib/utils";
import { RouteStage, RouteTransitionProvider } from "./route-transition";
import { AdminPortalLink } from "./admin-portal-link";

const MotionPreferences=createContext({enabled:true,ready:false});
export const useMotionPreferences=()=>useContext(MotionPreferences);

export function AppShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const reduce=useReducedMotion();
  const [enabled,setEnabled]=useState(true),[ready,setReady]=useState(false),[menuOpen,setMenuOpen]=useState(false);
  useEffect(()=>{try{const saved=localStorage.getItem("maat-motion");if(saved!==null)setEnabled(saved==="on");}catch{}setReady(true);},[]);
  useEffect(()=>{setMenuOpen(false);},[pathname]);
  const animate=enabled&&!reduce;
  const admin=pathname.startsWith("/admin"),assessment=pathname.startsWith("/assessment")||pathname.startsWith("/chat");
  const active=navigation.find(item=>pathname.startsWith(item.href));
  function toggle(value:boolean){setEnabled(value);try{localStorage.setItem("maat-motion",value?"on":"off");}catch{}}
  return <MotionPreferences.Provider value={{enabled:animate,ready}}><MotionConfig reducedMotion={animate?"never":"always"} transition={{duration:.32,ease:[.22,.68,.2,1]}}>
    <RouteTransitionProvider enabled={animate}><div className="relative isolate grid h-dvh min-h-0 grid-rows-[72px_minmax(0,1fr)_34px] overflow-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <motion.div className="absolute inset-0 bg-[radial-gradient(ellipse_at_22%_48%,#233c5042,transparent_65%)]" animate={{opacity:(pathname.startsWith("/scenarios")||assessment)?.72:.18}} transition={{duration:animate?.65:0}}/>
        <motion.div className="absolute -right-40 -bottom-56 h-[650px] w-[950px] -rotate-25 bg-[linear-gradient(100deg,#d195642b,#9eb9a12e,#7ca4c532,#9e82bf24)] blur-[110px]" animate={{opacity:pathname==="/framework"?.70:pathname==="/"?0:.12,x:pathname==="/framework"?-25:0}} transition={{duration:animate?.7:0}}/>
        <motion.div className="absolute top-0 left-[44%] h-[150%] w-[46%] origin-top -rotate-27 border-l border-sky-100/[.055] bg-gradient-to-r from-sky-100/[.025] to-transparent" animate={{opacity:(pathname.startsWith("/scenarios")||assessment)?.9:.35}} transition={{duration:animate?.6:0}}/>
      </div>
      <header className="relative z-30 border-b border-white/[.045] bg-[#07090df2]">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-8 px-6 lg:px-12">
          <Link href="/" aria-label="MACST 首页" className="flex shrink-0 items-center gap-3 rounded-sm outline-offset-8 focus-visible:outline-1 focus-visible:outline-sky-200"><img src="/prism.webp" alt="" width="28" height="28" className="size-8 object-contain brightness-110"/><span className="text-[25px] font-semibold tracking-[.09em] text-slate-100">MACST</span><span className="ml-1 hidden border-l border-slate-700/50 pl-4 text-[12px] tracking-wider text-slate-400 xl:block">情境行为评估</span></Link>
          <nav aria-label="主导航" className="ml-auto hidden h-full items-center gap-7 lg:flex lg:gap-8">{navigation.map(item=><Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href)?"page":undefined} className={cn("relative flex h-full items-center whitespace-nowrap text-[12px] transition-colors outline-none hover:text-slate-100 focus-visible:text-sky-100 focus-visible:after:absolute focus-visible:after:inset-x-0 focus-visible:after:bottom-3 focus-visible:after:h-px focus-visible:after:bg-sky-100",pathname.startsWith(item.href)?"text-slate-100":"text-slate-500")}>{item.label}{pathname.startsWith(item.href)&&<motion.span layoutId="active-navigation" transition={animate?{type:"spring",stiffness:360,damping:34}:{duration:0}} className="absolute right-1/3 bottom-[17px] left-1/3 h-px bg-sky-100/80"/>}</Link>)}<span className="ml-1 border-l border-white/10 pl-6"><AdminPortalLink/></span></nav>
          <div className="flex items-center gap-3 lg:ml-5"><label className="flex cursor-pointer items-center gap-2.5 text-[9px] text-slate-500"><span className="hidden lg:inline">{reduce?"系统减弱动效":"动效"}</span><Switch aria-label="开启动效" checked={animate} disabled={Boolean(reduce)} onCheckedChange={toggle} className="h-[17px] w-[29px] border border-white/10 data-[state=checked]:bg-slate-700 [&>span]:size-3 [&>span]:bg-slate-200 [&>span]:data-[state=checked]:translate-x-3 [&>span]:data-[state=unchecked]:translate-x-0"/></label>
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="打开菜单" className="text-slate-400 lg:hidden"><Menu className="size-5"/></Button></DialogTrigger><DialogContent className="max-w-[calc(100%-40px)] border-white/10 bg-[#0d141d] sm:max-w-sm"><DialogHeader><DialogTitle className="font-normal tracking-wide">MACST</DialogTitle><DialogDescription>选择你想进入的页面。</DialogDescription></DialogHeader><nav className="grid gap-1 py-4" aria-label="移动导航">{navigation.map(item=><Button key={item.href} asChild variant="ghost" className="justify-between py-6 font-normal"><Link href={item.href} onClick={()=>setMenuOpen(false)}>{item.label}<ArrowUpRight className="size-4 opacity-50"/></Link></Button>)}<AdminPortalLink mobile onOpen={()=>setMenuOpen(false)}/></nav></DialogContent></Dialog>
          </div>
        </div>
      </header>
      <RouteStage>{children}</RouteStage>
      <footer className="relative z-20 flex items-center justify-between border-t border-white/[.045] bg-background/90 px-6 font-mono text-[8px] tracking-widest text-slate-600 lg:px-9"><Link href="/" className="flex items-center gap-3 hover:text-slate-400"><span>MACST</span><span className="text-slate-800">/</span><span className="font-sans text-[9px] tracking-normal">{admin?"管理工作台":assessment?"情境互动":active?.label??"看见能力的不同侧面"}</span></Link><div className="flex items-center gap-6"><span>{admin?"ASSESSMENT STUDIO":assessment?"SCENARIO INTERACTION":active?`${active.chapter} / 04`:"PERSPECTIVES INTO EVIDENCE"}</span><Dialog><DialogTrigger asChild><button className="cursor-pointer font-sans text-[9px] tracking-normal outline-offset-4 hover:text-slate-300 focus-visible:outline-1">关于本系统</button></DialogTrigger><DialogContent className="border-white/10 bg-[#0d141d]"><DialogHeader><div className="mb-3 text-slate-500"><Sparkles className="size-5" strokeWidth={1.2}/></div><DialogTitle className="text-xl font-normal">从情境中，理解能力。</DialogTitle><DialogDescription className="pt-3 text-[13px] leading-7">这是 MACST 多智能体岗位胜任力情境测验：与多角色对话作答，系统保留原话作为行为证据，生成统一八维的行为观察报告。报告为特定情境中的观察反馈，供人工面试与复核使用，不单独用于高风险人事决策。</DialogDescription></DialogHeader></DialogContent></Dialog></div></footer>
    </div></RouteTransitionProvider>
  </MotionConfig></MotionPreferences.Provider>;
}
