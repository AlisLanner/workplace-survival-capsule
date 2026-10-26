import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import heroBg from "../assets/scenarios/hero-bg.webp";
import meetingImg from "../assets/scenarios/scenario-meeting.webp";
import restaurantImg from "../assets/scenarios/scenario-restaurant.webp";
import outageImg from "../assets/scenarios/scenario-outage.svg";
import handoverImg from "../assets/scenarios/scenario-handover.svg";
import firstWeekImg from "../assets/scenarios/scenario-firstweek.svg";
import { useReveal } from "../hooks/useReveal";
import { useSpotlight } from "../hooks/useSpotlight";

interface CaseEntry {
  title: string;
  meta: string;
  img: string;
}

const CASES: CaseEntry[] = [
  { title: "周三下午的会议室", meta: "汇报危机 · 资源协调 · 15 轮", img: meetingImg },
  { title: "8号桌的客人", meta: "出品事故 · 现场处置 · 15 轮", img: restaurantImg },
  { title: "零点大促的故障工单", meta: "服务事故 · 跨团队协同 · 15 轮", img: outageImg },
  { title: "接手的第三周", meta: "管理接盘 · 信息核实 · 15 轮", img: handoverImg },
  { title: "入职第一周的需求对接", meta: "新人困境 · 需求对接 · 15 轮", img: firstWeekImg }
];

interface FlowStep {
  n: string;
  l: string;
  f: string;
  live?: boolean;
}

const STEPS: FlowStep[] = [
  { n: "01", l: "准备回合", f: "Round setup" },
  { n: "02", l: "质量门", f: "Quality gate" },
  { n: "03", l: "Director", f: "调度" },
  { n: "04", l: "GroupGuard", f: "校验" },
  { n: "05", l: "Role Agent", f: "追问", live: true },
  { n: "06", l: "持久化", f: "Persist" },
  { n: "07", l: "结束门", f: "Finish gate" },
  { n: "08", l: "Judge", f: "按需采样" }
];

const STEP_DELAYS = [".05s", ".1s", ".15s", ".2s", ".25s", ".3s", ".35s", ".4s"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
}

export function HomePage() {
  useSpotlight();

  const heroRef = useRef<HTMLElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const titleEl = useRef<HTMLHeadingElement | null>(null);

  const kickerRef = useReveal<HTMLSpanElement>();
  const titleReveal = useReveal<HTMLHeadingElement>();
  const descRef = useReveal<HTMLParagraphElement>();
  const ctaRef = useReveal<HTMLDivElement>();
  const boardRef = useReveal<HTMLElement>();
  const wfKickerRef = useReveal<HTMLSpanElement>();
  const wfTitleRef = useReveal<HTMLHeadingElement>();
  const wfDescRef = useReveal<HTMLParagraphElement>();
  const stepRefs = [
    useReveal<HTMLDivElement>(),
    useReveal<HTMLDivElement>(),
    useReveal<HTMLDivElement>(),
    useReveal<HTMLDivElement>(),
    useReveal<HTMLDivElement>(),
    useReveal<HTMLDivElement>(),
    useReveal<HTMLDivElement>(),
    useReveal<HTMLDivElement>()
  ];

  useEffect(() => {
    const hero = heroRef.current!;
    const cv = canvasRef.current!;
    const bg = bgRef.current!;
    const title = titleEl.current!;
    if (!hero || !cv || !bg || !title) return;
    const ctx = cv.getContext("2d")!;
    if (!ctx) return;

    const N = 64;
    const LINK = 130;
    const MLINK = 180;
    const COLS = ["rgba(227,195,126,", "rgba(91,216,194,"];
    let W = 0;
    let H = 0;
    let pts: Particle[] = [];
    let mx = -9999;
    let my = -9999;
    let raf = 0;

    function resize() {
      W = cv.width = hero.clientWidth;
      H = cv.height = hero.clientHeight;
    }

    function seed() {
      const count = window.innerWidth < 980 ? Math.floor(N / 2) : N;
      pts = [];
      for (let i = 0; i < count; i++) {
        pts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.32,
          vy: (Math.random() - 0.5) * 0.32,
          r: Math.random() * 1.5 + 0.6,
          c: COLS[i % 2]
        });
      }
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 7);
        ctx.fillStyle = p.c + "0.65)";
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = "rgba(227,195,126," + 0.13 * (1 - d2 / (LINK * LINK)) + ")";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < MLINK * MLINK) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = "rgba(91,216,194," + 0.3 * (1 - d2 / (MLINK * MLINK)) + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(tick);
    }

    function onMove(e: MouseEvent) {
      const r = hero.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      bg.style.transform = `scale(1.06) translate(${(-nx * 26).toFixed(1)}px, ${(-ny * 18).toFixed(1)}px)`;
      title.style.setProperty("--shx", String(Math.round((nx + 0.5) * 100)));
    }

    function onLeave() {
      mx = -9999;
      my = -9999;
      bg.style.transform = "scale(1.06)";
    }

    function onResize() {
      resize();
      seed();
    }

    resize();
    seed();
    tick();
    hero.addEventListener("mousemove", onMove);
    hero.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      hero.removeEventListener("mousemove", onMove);
      hero.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <main>
      <section className="hero-full" ref={heroRef}>
        <div className="hero-bg" ref={bgRef} />
        <div className="hero-veil" />
        <canvas id="heroFx" ref={canvasRef} />
        <div className="wrap hero-grid">
          <div className="hero-left">
            <span className="kicker" ref={kickerRef} data-reveal>
              MACST · Multi-agent Competency Situational Test
            </span>
            <h1
              className="h1 sheen"
              data-reveal
              style={{ "--d": ".08s" } as CSSProperties}
              ref={(el) => {
                titleReveal.current = el;
                titleEl.current = el;
              }}
            >
              基于 LLM Multi-Agent 的
              <br />
              情境行为评估系统
            </h1>
            <p className="hero-desc" ref={descRef} data-reveal style={{ "--d": ".16s" } as CSSProperties}>
              在高压情境里与多个角色对话，系统记录你的原话，抽取行为证据，生成一份可追溯的行为观察报告。
            </p>
            <div className="cta-row" ref={ctaRef} data-reveal style={{ "--d": ".24s" } as CSSProperties}>
              <Link to="/scenarios" className="btn btn-gold">
                进入评估情境
              </Link>
              <Link to="/admin" className="btn btn-ghost">
                查看管理端
              </Link>
            </div>
          </div>

          <aside className="board glass" ref={boardRef} data-reveal style={{ "--d": ".3s" } as CSSProperties}>
            <div className="board-head">
              <span>评估情境</span>
              <b>05</b>
            </div>
            {CASES.map((c) => (
              <Link key={c.title} to="/scenarios" className="case">
                <img src={c.img} alt={c.title} />
                <div>
                  <div className="t">{c.title}</div>
                  <div className="m">{c.meta}</div>
                </div>
              </Link>
            ))}
          </aside>
        </div>
      </section>

      <section className="workflow">
        <div className="wrap">
          <div className="workflow-head">
            <span className="kicker" ref={wfKickerRef} data-reveal>
              Agent Workflow
            </span>
            <h2 className="h2" ref={wfTitleRef} data-reveal style={{ "--d": ".08s" } as CSSProperties}>
              一次回答如何触发下一轮追问
            </h2>
            <p className="muted" ref={wfDescRef} data-reveal style={{ "--d": ".16s" } as CSSProperties}>
              每一轮回应都会经过八个 LangGraph 节点：准备回合、质量门、Director、GroupGuard、Role Agent、持久化、结束门、Judge。
              Role Agent 只看当前情境与指令，评分细则始终隔离。
            </p>
          </div>
          <div className="flow">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className={`step${s.live ? " live" : ""}`}
                data-reveal
                style={{ "--d": STEP_DELAYS[i] } as CSSProperties}
                ref={stepRefs[i]}
              >
                <span className="n">{s.n}</span>
                <span className="l">{s.l}</span>
                <span className="f">{s.f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span>MACST · 情境行为评估系统</span>
          <span>本地运行 · SQLite 持久化 · Mock / DeepSeek 双模式</span>
        </div>
      </footer>
    </main>
  );
}
