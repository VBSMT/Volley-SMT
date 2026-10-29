"use client";

import { useState } from "react";

const W = 340;
const H = 130;
const PAD = { top: 14, right: 14, bottom: 22, left: 28 };
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/** Évolution d'une valeur au fil des photos du classement (série unique, ligne de zéro si négatif). */
export function TrendChart({ points, label, signedValues = false }: { points: { date: string; value: number }[]; label: string; signedValues?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  if (n < 2) return null;
  const fmt = (v: number) => (signedValues && v > 0 ? `+${v}` : String(v));
  const vals = points.map((p) => p.value);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(1, ...vals);
  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (n - 1);
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const shown = active ?? n - 1;
  const ticks = [...new Set([lo, 0, hi])];

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} : ${fmt(vals[n - 1])} actuellement`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 && lo < 0 ? "axis" : "grid"} />
            <text x={PAD.left - 6} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{fmt(t)}</text>
          </g>
        ))}
        <text x={PAD.left} y={H - 4} className="tick">{day(points[0].date)}</text>
        <text x={W - PAD.right} y={H - 4} className="tick" textAnchor="end">{day(points[n - 1].date)}</text>
        {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />}
        <path d={path} className="line" />
        <circle cx={x(shown)} cy={y(points[shown].value)} r={5} className="dot" />
        <text
          x={x(shown) + (shown === n - 1 ? -12 : shown === 0 ? 12 : 0)}
          y={y(points[shown].value) + (shown === n - 1 || shown === 0 ? -8 : -12)}
          className="value-label"
          textAnchor={shown === n - 1 ? "end" : shown === 0 ? "start" : "middle"}
        >
          {fmt(points[shown].value)}
          {active !== null && ` · ${day(points[shown].date)}`}
        </text>
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={x(i) - (W - PAD.left - PAD.right) / (2 * (n - 1))}
            y={PAD.top}
            width={(W - PAD.left - PAD.right) / (n - 1)}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            tabIndex={0}
            aria-label={`${day(p.date)} : ${fmt(p.value)}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          />
        ))}
      </svg>
    </figure>
  );
}
