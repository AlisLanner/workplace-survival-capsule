import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { listScenarios, startAssessment } from "../api/assessment.api";
import { getScenarioPresentation } from "../config/scenarioPresentation";
import { useReveal } from "../hooks/useReveal";
import { useSpotlight } from "../hooks/useSpotlight";
import type { Scenario } from "../types/assessment";

const NICKNAME_KEY = "maat_nickname";

function getStoredNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeNickname(value: string) {
  try {
    localStorage.setItem(NICKNAME_KEY, value);
  } catch {
    // ignore
  }
}

export function ScenarioPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [nickname, setNickname] = useState(getStoredNickname);
  const [nicknameError, setNicknameError] = useState(false);
  const nicknameBarRef = useRef<HTMLDivElement | null>(null);
  const nicknameInputRef = useRef<HTMLInputElement | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  useSpotlight();

  const kickerRef = useReveal<HTMLSpanElement>();
  const titleRef = useReveal<HTMLHeadingElement>();
  const descRef = useReveal<HTMLParagraphElement>();
  const nickRef = useReveal<HTMLDivElement>();

  useEffect(() => {
    listScenarios()
      .then(setScenarios)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Cards render after the async fetch; observe them once data is in so the
  // reveal system (same thresholds as useReveal) applies to each card.
  useEffect(() => {
    if (!scenarios.length) return;
    const els = Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-reveal]") ?? []);
    if (!els.length) return;
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [scenarios]);

  function handleNicknameChange(value: string) {
    setNickname(value);
    storeNickname(value);
    if (nicknameError && value.trim()) {
      setNicknameError(false);
    }
  }

  async function start(scenarioId: string) {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      // 未填昵称：滚动到昵称栏并聚焦，给出明确提示，避免被误认为系统卡顿。
      setNicknameError(true);
      nicknameBarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => nicknameInputRef.current?.focus({ preventScroll: true }), 350);
      return;
    }

    setStartingId(scenarioId);
    setError(null);
    try {
      const result = await startAssessment({ scenario_id: scenarioId, nickname: trimmedNickname });
      navigate(`/chat/${result.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动失败");
    } finally {
      setStartingId(null);
    }
  }

  return (
    <main className="wrap page">
      <div className="page-head">
        <span className="kicker" ref={kickerRef} data-reveal>
          SCENARIOS · 评估情境
        </span>
        <h1 className="h1" ref={titleRef} data-reveal style={{ "--d": ".08s" } as CSSProperties}>
          选择一个情境，进入评估
        </h1>
        <p className="muted" ref={descRef} data-reveal style={{ "--d": ".16s" } as CSSProperties}>
          每个情境都是一段高压现场：限定轮次内与多个角色对话，系统全程记录你的原话作为评估证据。
        </p>
      </div>

      <div data-reveal ref={nickRef}>
        <div ref={nicknameBarRef} className={`nickname-bar glass ${nicknameError ? "error shake" : ""}`}>
          <label htmlFor="nickname">
            你的昵称 <b className="required">*</b>
          </label>
          <input
            id="nickname"
            ref={nicknameInputRef}
            type="text"
            value={nickname}
            onChange={(e) => handleNicknameChange(e.target.value)}
            placeholder="请先填写昵称，再开始评估"
            maxLength={16}
          />
          {nicknameError ? <span className="nickname-error">请先填写昵称再开始评估</span> : <span className="nickname-hint">昵称用于区分会话记录</span>}
        </div>
      </div>

      {loading ? <p className="loading">加载评估情境中…</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <div className="scn-grid" ref={gridRef}>
        {scenarios.map((scenario, i) => {
          const presentation = getScenarioPresentation(scenario);
          const opening = scenario.assessmentVersion?null:scenario.openingMessage;
          const code=({project_demo_crisis:"A",coffee_shop_complaint:"B",promo_outage_crisis:"C",handover_review_crisis:"D",first_week_assignment:"E"} as Record<string,string>)[scenario.id]??"";

          return (
            <article
              key={scenario.id}
              className="glass scn-card spot"
              data-reveal
              style={{ "--d": `${0.1 + i * 0.1}s` } as CSSProperties}
            >
              <div className="scn-cover">
                <img src={presentation.backgroundImage} alt={scenario.title} />
                <span className="tagline">SCENARIO {code}</span>
              </div>
              <div className="scn-body">
                <h3 className="h3">{scenario.title}</h3>
                <div className="scn-meta">
                  <span className="chip">{scenario.maxRound} 轮</span>
                  <span className="chip">群聊机制</span>
                  <span className="chip">{presentation.badge}</span>
                  <span className="chip">{scenario.assessmentVersion?"统一八维新版":"旧版演示 · 独立解释"}</span>
                </div>
                <p className="muted small">{scenario.description}</p>
                <div className="task">
                  <b>任务卡 — </b>
                  {scenario.backgroundForUser}
                </div>
                {opening ? (
                  <div className="opening">
                    <span className="who">
                      开场 · {opening.speaker}（{opening.role}）
                    </span>
                    “{opening.content}”
                  </div>
                ) : null}
                <div className="scn-foot">
                  <span className="small muted">多角色追问 · 保留原话</span>
                  <button
                    className="btn btn-gold"
                    disabled={startingId === scenario.id}
                    onClick={() => start(scenario.id)}
                  >
                    {startingId === scenario.id ? "启动中…" : "开始评估"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
