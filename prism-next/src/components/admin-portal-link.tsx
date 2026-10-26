"use client";

import { ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
import { TransitionLink as Link } from "./transition-link";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function AdminPortalLink({ mobile = false, onOpen }: { mobile?: boolean; onOpen?: () => void }) {
  const active = usePathname().startsWith("/admin");
  return <Button asChild variant={mobile ? "ghost" : "outline"} className={cn(
    "group relative overflow-hidden font-normal text-slate-300 transition-colors hover:text-slate-100", active && "border-sky-100/30 bg-sky-100/[.06] text-sky-100",
    mobile ? "mt-3 h-12 w-full justify-between border-t border-white/10 pt-3 text-sm hover:bg-white/[.035]" : "h-8 gap-2.5 rounded-full border-white/[.13] bg-white/[.025] px-3.5 text-[11px] hover:border-sky-100/30 hover:bg-sky-100/[.055]"
  )}>
    <Link href="/admin" aria-current={active ? "page" : undefined} data-admin-portal aria-label="管理端" title="进入管理工作台" onClick={onOpen}>
      <span aria-hidden="true" className="pointer-events-none absolute -inset-y-2 left-0 w-1/3 -translate-x-[180%] -skew-x-20 bg-gradient-to-r from-transparent via-sky-100/10 to-transparent transition-transform duration-700 group-hover:translate-x-[430%] motion-reduce:hidden" />
      <span className="relative flex items-center gap-2.5"><SlidersHorizontal className="size-3.5 text-slate-400" strokeWidth={1.4} />管理端</span>
      <ArrowUpRight className="relative size-3 text-slate-500 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" strokeWidth={1.4} />
    </Link>
  </Button>;
}
