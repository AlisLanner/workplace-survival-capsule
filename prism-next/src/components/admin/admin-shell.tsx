"use client";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { LayoutDashboard, Layers3, ClipboardList, Braces, ArrowLeft, Gem } from "lucide-react";
import { TransitionLink as Link } from "../transition-link";
import { useMotionPreferences } from "../app-shell";
import { cn } from "@/lib/utils";

const items = [{ href: "/admin", label: "工作台概览", icon: LayoutDashboard }, { href: "/admin/scenarios", label: "场景与岗位", icon: Layers3 }, { href: "/admin/records", label: "测评记录", icon: ClipboardList }, { href: "/admin/prompts", label: "提示词管理", icon: Braces }];
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(), { enabled } = useMotionPreferences();
  return <div className="mx-auto grid min-h-[calc(100dvh-106px)] max-w-[1600px] lg:grid-cols-[224px_minmax(0,1fr)]">
    <aside className="relative border-b border-white/[.065] bg-slate-900/10 px-5 py-5 lg:border-r lg:border-b-0 lg:px-5 lg:py-9">
      <div className="mb-6 hidden items-center gap-3 px-3 lg:flex"><Gem className="size-5 text-sky-100/65" strokeWidth={1.15} /><div><p className="text-[12px] tracking-wider text-slate-200">管理工作台</p><p className="mt-1.5 font-mono text-[7px] tracking-[.22em] text-slate-600">ASSESSMENT STUDIO</p></div></div>
      <nav aria-label="管理导航" className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1 lg:gap-2">{items.map(item => {
        const active = pathname === item.href; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("relative flex items-center gap-2.5 overflow-hidden rounded-lg px-3 py-3 text-[11px] outline-offset-2 transition-colors hover:text-slate-100 focus-visible:outline-1 focus-visible:outline-sky-100 lg:text-[12px]", active ? "text-sky-100" : "text-slate-500")}>
          {active && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-lg border border-sky-100/10 bg-[linear-gradient(110deg,#8bb7d314,#8bb7d303)]" transition={{ duration: enabled ? .3 : 0 }} />}<item.icon className="relative size-4" strokeWidth={1.3} /><span className="relative">{item.label}</span>
        </Link>;
      })}</nav>
      <div className="mt-8 hidden px-3 lg:block"><div className="h-px bg-gradient-to-r from-white/10 to-transparent" /><p className="mt-5 text-[10px] leading-6 text-slate-600">以岗位定义情境，<br />让观察回到行为。</p><Link href="/" className="mt-8 inline-flex items-center gap-2 text-[10px] text-slate-500 hover:text-slate-200"><ArrowLeft className="size-3" />返回首页</Link></div>
    </aside>
    <div className="min-w-0 px-6 pt-7 pb-10 md:px-9 lg:px-10 lg:pt-9 xl:px-12">{children}</div>
  </div>;
}
export function AdminHeading({ kicker, title, description, children }: { kicker: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><div className="mb-3 flex items-center gap-3"><p className="font-mono text-[8px] tracking-[.22em] text-slate-500">{kicker}</p><span className="rounded-full border border-sky-100/10 bg-sky-100/[.025] px-2 py-0.5 text-[8px] text-slate-500">已连接正式数据</span></div><h1 className="text-[28px] font-normal tracking-tight text-slate-100">{title}</h1><p className="mt-3 max-w-[620px] text-[11px] leading-6 text-slate-500">{description}</p></div>{children}</div>;
}
