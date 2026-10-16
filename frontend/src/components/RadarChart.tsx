import { useEffect, useRef } from "react";
import type { Report } from "../types/assessment";

const dimensionMaxScore = 20;
const SIZE = 380;
const RADIUS = 122;
const FONT = "var(--body)";

/**
 * Self-drawn radar; the report supplies its frozen axis names and order.
 * Animation runs once after mount: rings fade in, gold polygon draws with
 * stroke-dasharray (1.4s), fill fades in (delay .9s), vertices pop in one by one.
 */
export function RadarChart({ data }: { data: Report["radar_chart_data"] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const items = data.map((item) => ({
    ...item,
    score: Math.max(0, Math.min(dimensionMaxScore, item.score))
  }));
  const count = items.length;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const frame = requestAnimationFrame(() => {
      svg.querySelectorAll<SVGPolygonElement>(".radar-ring").forEach((ring) => {
        ring.style.opacity = "1";
      });
      const poly = svg.querySelector<SVGPolygonElement>(".radar-poly");
      if (poly) {
        const length = poly.getTotalLength();
        poly.style.strokeDasharray = `${length}`;
        poly.style.strokeDashoffset = `${length}`;
        poly.style.fillOpacity = "0";
        void poly.getBoundingClientRect();
        poly.style.transition =
          "stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1), fill-opacity 1s ease .9s";
        poly.style.strokeDashoffset = "0";
        poly.style.fillOpacity = "1";
      }
      svg.querySelectorAll<SVGCircleElement>(".radar-dot").forEach((dot) => {
        dot.style.opacity = "1";
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (count === 0) return null;

  const point = (index: number, scale = 1) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      x: SIZE / 2 + Math.cos(angle) * RADIUS * scale,
      y: SIZE / 2 + Math.sin(angle) * RADIUS * scale,
      angle
    };
  };

  const ringPoints = (fraction: number) =>
    Array.from({ length: count }, (_, i) => {
      const p = point(i, fraction);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");

  const dataPoints = items
    .map((item, i) => {
      const p = point(i, item.score / dimensionMaxScore);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      role="img"
      aria-label="维度得分雷达图"
    >
      {[0.25, 0.5, 0.75, 1].map((fraction, ringIndex) => (
        <polygon
          key={fraction}
          className="radar-ring"
          points={ringPoints(fraction)}
          fill="none"
          stroke="rgba(255,255,255,.08)"
          style={{ opacity: 0, transition: `opacity .6s ease ${ringIndex * 0.12}s` }}
        />
      ))}
      {items.map((_, i) => {
        const p = point(i);
        return (
          <line
            key={i}
            x1={SIZE / 2}
            y1={SIZE / 2}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,.07)"
          />
        );
      })}
      {items.map((item, i) => {
        const p = point(i);
        const anchor = "middle";
        return (
          <text
            key={item.name}
            x={SIZE / 2 + Math.cos(p.angle) * (RADIUS + 26)}
            y={SIZE / 2 + Math.sin(p.angle) * (RADIUS + 26)}
            fontSize={11.5}
            fill="#A39C8C"
            textAnchor={anchor}
            dominantBaseline="middle"
            style={{ fontFamily: FONT }}
          >
            {item.name}
          </text>
        );
      })}
      <polygon
        className="radar-poly"
        points={dataPoints}
        fill="rgba(227,195,126,.12)"
        stroke="#E3C37E"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 14px rgba(227,195,126,.25))" }}
      />
      {items.map((item, i) => {
        const p = point(i, item.score / dimensionMaxScore);
        return (
          <circle
            key={item.name}
            className="radar-dot"
            cx={p.x}
            cy={p.y}
            r={3.2}
            fill="#E3C37E"
            style={{ opacity: 0, transition: `opacity .4s ease ${0.9 + i * 0.05}s` }}
          />
        );
      })}
    </svg>
  );
}
