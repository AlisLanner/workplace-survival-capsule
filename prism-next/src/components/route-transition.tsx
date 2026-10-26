"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import { scenes, type Scene } from "@/lib/content";
import { getSceneProfile } from "@/lib/scene-profiles";
import { SceneArt } from "./scene-art";
import { ScenarioCover } from "./scenario-cover";

type Rect = { left: number; top: number; width: number; height: number };
type Kind = "glass" | "spectrum" | "focus" | "settle";
type Phase = "leaving" | "waiting" | "entering";
type CardLift = { code: string; rect: Rect; source: HTMLElement; destination?: HTMLElement; target?: Rect };
type Journey = { id: number; href: string; direction: number; kind: Kind; phase: Phase; card?: CardLift };
type NavigateOptions = { replace?: boolean; card?: { code: string; source: HTMLElement } };
type NavigationContext = {
  navigate: (href: string, options?: NavigateOptions) => Promise<void>;
  registerDestination: (code: string) => void;
  viewport: RefObject<HTMLElement | null>;
  surface: ReturnType<typeof useAnimationControls>;
  journey: Journey | null;
  revision: RefObject<number>;
  epoch: number;
};
const Navigation = createContext<NavigationContext | null>(null);
const ease = [.22, .72, .18, 1] as const;
const rest = { opacity: 1, x: 0, y: 0, filter: "blur(0px)" };
const order = (path: string) => (path.startsWith("/scenarios") || path.startsWith("/assessment")) ? 1 : path === "/framework" ? 2 : path === "/process" ? 3 : path === "/about" ? 4 : path.startsWith("/admin") ? 5 : 0;
function kindFor(from: string, to: string): Kind {
  if (to === "/framework" || (from === "/framework" && to.startsWith("/scenarios"))) return "spectrum";
  if (to === "/process" || from === "/process") return "focus";
  if (to.startsWith("/admin")) return "focus";
  if (to.startsWith("/scenarios") || to.startsWith("/assessment")) return "glass";
  return "settle";
}
function box(element: HTMLElement): Rect {
  const r = element.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
function restore(card?: CardLift) {
  if (card?.source) card.source.style.removeProperty("visibility");
  if (card?.destination) card.destination.style.removeProperty("visibility");
}

export function useRouteTransition() {
  const context = useContext(Navigation);
  if (!context) throw new Error("Navigation transition provider is missing");
  return context;
}

export function RouteTransitionProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const router = useRouter(), pathname = usePathname();
  const viewport = useRef<HTMLElement>(null);
  const surface = useAnimationControls();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [epoch, setEpoch] = useState(0);
  const intent = useRef<Journey | null>(null), revision = useRef(0), previous = useRef(pathname);
  const guard = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled), pathRef = useRef(pathname);
  enabledRef.current = enabled;
  pathRef.current = pathname;

  const finish = useCallback((id: number) => {
    if (intent.current?.id !== id) return;
    restore(intent.current.card);
    intent.current = null;
    if (guard.current) clearTimeout(guard.current);
    guard.current = null;
    surface.stop();
    surface.set(rest);
    setJourney(null);
  }, [surface]);

  /** 异步页面（客户端取数）的封面挂载晚于路由提交；封面挂载后调用此登记，把飞牌接到迟到的落点上。 */
  const registerDestination = useCallback((code: string) => {
    const current = intent.current;
    if (!current?.card || current.phase !== "entering" || current.card.target || current.card.code !== code) return;
    const destination = viewport.current?.querySelector<HTMLElement>(`[data-scenario-cover="${code}"]`);
    if (!destination) return;
    current.card.destination = destination;
    current.card.target = box(destination);
    destination.style.visibility = "hidden";
    setJourney({ ...current });
  }, []);

  const navigate = useCallback(async (href: string, options: NavigateOptions = {}) => {
    const from = pathRef.current;
    const id = ++revision.current;
    setEpoch(id);
    const hadPendingNavigation = intent.current !== null;
    if (guard.current) clearTimeout(guard.current);
    restore(intent.current?.card);
    surface.stop();
    if (href === from || !enabledRef.current) {
      intent.current = null;
      setJourney(null);
      surface.set(rest);
      if (href !== from || hadPendingNavigation) options.replace ? router.replace(href) : router.push(href);
      return;
    }
    const card = options.card ? { ...options.card, rect: box(options.card.source) } : undefined;
    const next: Journey = { id, href, direction: Math.sign(order(href) - order(from)) || 1, kind: kindFor(from, href), phase: "leaving", card };
    intent.current = next;
    setJourney(next);
    router.prefetch(href);
    // A guard only recovers a failed route load. Normal motion follows completion events.
    // 带卡片的转场若落点迟迟不出现（异步页面加载失败等），缩短兜底时间，避免飞牌悬停压在新页面上。
    guard.current = setTimeout(() => finish(id), card ? 3000 : 8000);
    await surface.start({ opacity: 0, x: card ? 0 : -next.direction * 14, y: card ? -5 : -6, filter: card ? "blur(2px)" : "blur(5px)", transition: { duration: card ? .30 : .36, ease } });
    if (intent.current?.id !== id) return;
    intent.current = { ...intent.current, phase: "waiting" };
    setJourney(intent.current);
    options.replace ? router.replace(href) : router.push(href);
  }, [finish, router, surface]);

  // Lift the cover out of the fading old page only after its replica has mounted.
  useLayoutEffect(() => {
    if (journey?.card && journey.phase === "leaving") journey.card.source.style.visibility = "hidden";
  }, [journey]);

  useLayoutEffect(() => {
    const changed = previous.current !== pathname;
    if (!changed) return;
    const from = previous.current;
    previous.current = pathname;
    viewport.current?.scrollTo({ top: 0, behavior: "instant" });
    const current = intent.current;
    if (current && current.href !== pathname) return;
    if (!enabledRef.current) {
      if (current) finish(current.id);
      surface.set(rest);
      return;
    }
    // Browser back/forward has no outgoing click; still provide a themed arrival.
    const next = current ?? { id: ++revision.current, href: pathname, direction: Math.sign(order(pathname) - order(from)) || -1, kind: kindFor(from, pathname), phase: "entering" as const };
    surface.set({ opacity: 0, x: next.card ? 0 : next.direction * 20, y: next.card ? 0 : 8, filter: next.card ? "blur(0px)" : "blur(5px)" });
    if (next.card) {
      const destination = viewport.current?.querySelector<HTMLElement>(`[data-scenario-cover="${next.card.code}"]`);
      if (destination) {
        next.card.destination = destination;
        next.card.target = box(destination);
        destination.style.visibility = "hidden";
      }
    }
    const arriving: Journey = { ...next, phase: "entering" };
    intent.current = arriving;
    setJourney(arriving);
    void surface.start({ ...rest, transition: { duration: next.card ? .68 : .72, delay: next.card ? .12 : .03, ease } }).then(() => {
      if (!next.card?.target) finish(next.id);
    });
  }, [finish, pathname, surface]);

  useEffect(() => {
    if (!enabled && intent.current) {
      const pending = intent.current;
      finish(pending.id);
      if (pending.href !== pathRef.current) router.push(pending.href);
    }
  }, [enabled, finish, router]);
  useEffect(() => {
    const resize = () => { if (intent.current?.card) finish(intent.current.id); };
    addEventListener("resize", resize);
    return () => { removeEventListener("resize", resize); if (guard.current) clearTimeout(guard.current); restore(intent.current?.card); };
  }, [finish]);

  return <Navigation.Provider value={{ navigate, registerDestination, viewport, surface, journey, revision, epoch }}>
    {children}
    <AnimatePresence>{journey && !journey.card && <LightPass key={journey.id} journey={journey} />}</AnimatePresence>
    {journey?.card && <FlyingCard key={journey.id} journey={journey} onLand={() => finish(journey.id)} />}
  </Navigation.Provider>;
}

export function RouteStage({ children }: { children: React.ReactNode }) {
  const { viewport, surface, journey } = useRouteTransition();
  return <main ref={viewport} id="main-content" aria-busy={journey ? true : undefined} data-transition-phase={journey?.phase ?? "idle"} data-transition-kind={journey?.card ? "card" : journey?.kind ?? "none"} className="relative min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-color:#40526855_transparent] [scrollbar-width:thin]">
    <motion.div initial={false} animate={surface} inert={journey ? true : undefined} className="min-h-full will-change-[transform,opacity]">{children}</motion.div>
  </main>;
}

/** Light is the shared material: glass → dispersed color → focused evidence. */
function LightPass({ journey }: { journey: Journey }) {
  const arriving = journey.phase === "entering", direction = journey.direction;
  return <motion.div aria-hidden="true" data-route-light={journey.kind} className="pointer-events-none fixed inset-x-0 top-[72px] bottom-[34px] z-40 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .23 }}>
    {journey.kind === "glass" ? <>
      <motion.div className="absolute -top-1/3 h-[170%] w-[43%] -rotate-18 border-x border-sky-100/20 bg-[linear-gradient(90deg,transparent,#a6cce514_10%,#d4eaf11d_48%,#a6c9e00c_80%,transparent)] shadow-[inset_8px_0_38px_#b9d7ed0c]" initial={{ x: `${direction > 0 ? 160 : -70}%`, opacity: 0 }} animate={{ x: arriving ? `${direction > 0 ? -45 : 185}%` : "65%", opacity: arriving ? 0 : .9 }} transition={{ duration: arriving ? .85 : .45, ease }} />
      <motion.div className="absolute top-[22%] left-[10%] h-[45%] w-[80%] -rotate-12 bg-[linear-gradient(90deg,transparent,#8db5d72b,#b6c9c51c,transparent)] blur-[36px]" initial={{ opacity: 0 }} animate={{ opacity: arriving ? 0 : .72 }} transition={{ duration: .55 }} />
    </> : journey.kind === "spectrum" ? <>
      <motion.div className="absolute top-[22%] -left-[10%] h-[54%] w-[120%] -rotate-12 bg-[linear-gradient(180deg,transparent,#d0a3812b_19%,#d7c9a12e_33%,#9ac3b238_48%,#8bb9d340_61%,#a18cbd38_76%,transparent)] blur-[30px]" initial={{ opacity: 0, x: -direction * 110, scaleY: .32 }} animate={{ opacity: arriving ? 0 : 1, x: arriving ? direction * 160 : 0, scaleY: arriving ? 1.8 : 1 }} transition={{ duration: arriving ? .90 : .44, ease }} />
      <motion.div className="absolute top-[31%] left-[8%] h-px w-[84%] -rotate-12 bg-gradient-to-r from-transparent via-sky-100/35 to-transparent blur-[1px]" initial={{ opacity: 0, scaleX: .3 }} animate={{ opacity: arriving ? 0 : .8, scaleX: arriving ? 1.1 : .8, y: arriving ? 70 : 0 }} transition={{ duration: .7, ease }} />
    </> : journey.kind === "focus" ? <>
      <motion.div className="absolute top-[35%] left-[-10%] h-[32%] w-[120%] -rotate-9 bg-[linear-gradient(180deg,transparent,#c6ae9635,#a8c5bf42,#a3acd536,transparent)] blur-[25px]" initial={{ opacity: 0, scaleY: 1.7, x: -direction * 80 }} animate={{ opacity: arriving ? 0 : 1, scaleY: arriving ? .12 : .65, x: arriving ? direction * 100 : 0 }} transition={{ duration: arriving ? .85 : .44, ease }} />
      <motion.div className="absolute top-1/2 left-[12%] h-px w-[76%] -rotate-9 bg-gradient-to-r from-transparent via-slate-100/65 to-transparent shadow-[0_0_22px_#c2e0e430]" initial={{ opacity: 0, scaleX: .2 }} animate={{ opacity: arriving ? 0 : .85, scaleX: arriving ? 1.15 : .85 }} transition={{ duration: .7, ease }} />
    </> : <motion.div className="absolute -top-[20%] left-[18%] h-[130%] w-[65%] -rotate-20 bg-[radial-gradient(ellipse_at_center,#b2c8d238,#a3b6c114_34%,transparent_68%)] blur-[30px]" initial={{ opacity: 0, x: -direction * 110, scale: .9 }} animate={{ opacity: arriving ? 0 : 1, x: arriving ? direction * 70 : 0, scale: arriving ? 1.2 : 1 }} transition={{ duration: arriving ? .85 : .44, ease }} />}
  </motion.div>;
}

function FlyingCard({ journey, onLand }: { journey: Journey; onLand: () => void }) {
  // 自定义情境的视觉档案由场景列表页写入注册表，未注册时回退通用档案。
  const card = journey.card!, scene = getSceneProfile(card.code);
  const landed = Boolean(card.target), target = card.target ?? card.rect;
  return <motion.div aria-hidden="true" data-card-bridge={card.code} data-card-flight={landed ? "landing" : "lifted"} className="pointer-events-none fixed z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#101923] shadow-[0_24px_65px_#0008]" initial={{ ...card.rect, opacity: 1, borderRadius: 12 }} animate={{ ...target, opacity: 1, borderRadius: landed ? 16 : 12 }} transition={{ duration: .90, ease: [.22, .76, .18, 1] }} onAnimationComplete={() => { if (landed) onLand(); }}>
    <motion.div className="absolute inset-0" initial={false} animate={{ opacity: landed ? 0 : 1 }} transition={{ duration: .45, delay: landed ? .12 : 0 }}><SmallCover scene={scene} /></motion.div>
    <motion.div className="absolute inset-0 [&>div]:h-full [&>div]:border-0 [&>div]:shadow-none" initial={{ opacity: 0 }} animate={{ opacity: landed ? 1 : 0 }} transition={{ duration: .55, delay: .22 }}><ScenarioCover scene={scene} bridge /></motion.div>
    <motion.div className="absolute -inset-y-10 -left-1/2 w-1/3 rotate-15 bg-gradient-to-r from-transparent via-sky-100/10 to-transparent blur-lg" initial={{ x: "-80%" }} animate={{ x: landed ? "650%" : "-80%" }} transition={{ duration: 1, ease }} />
  </motion.div>;
}

function SmallCover({ scene }: { scene: Scene }) {
  return <div className="h-full overflow-hidden bg-[linear-gradient(145deg,#1a2431,#0c131d_70%)]">
    <div className="relative aspect-[1.6] overflow-hidden border-b border-white/[.07]"><SceneArt scene={scene} idPrefix="bridge-small" /><span className="absolute top-4 left-4 font-mono text-[9px] tracking-[.22em] text-slate-300/55">{scene.code} / 04</span><ArrowUpRight className="absolute top-4 right-4 size-3.5 text-slate-200/40" strokeWidth={1.25} /></div>
    <div className="px-4 pt-5 pb-5 sm:px-5"><div className="flex items-center gap-2 text-[9px] tracking-wider text-slate-500"><span className="size-1 rounded-full" style={{ backgroundColor: scene.tone }} />{scene.category}</div><div className="mt-3 text-[20px] leading-[1.35] tracking-[-.025em] text-slate-100 sm:text-[22px]">{scene.line1}<br />{scene.line2}</div><p className="mt-3 min-h-9 text-[10px] leading-[1.8] text-slate-500">{scene.summary}</p><div className="mt-4 flex items-center justify-between border-t border-white/[.06] pt-3 text-[8px] text-slate-600"><span>{scene.role}</span><Check className="size-3 text-sky-100/70" /></div></div>
  </div>;
}
