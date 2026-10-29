"use client";

import { useState } from "react";

const W = 340;
const H = 180;
const PAD = { top: 16, right: 16, bottom: 28, left: 28 };

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/**
 * Évolution du rang (série unique : pas de légende, le titre la nomme).
 * Axe inversé (1er en haut), grille discrète, infobulle au survol et au clavier.
 */
export function RankChart({ points, poolSize }: { points: { date: string; rank: number }[]; poolSize: number }) {
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const x = (i: number) => PAD.left + (n === 1 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (n - 1));
  const y = (rank: number) => PAD.top + ((rank - 1) * (H - PAD.top - PAD.bottom)) / Math.max(1, poolSize - 1);
  const ticks = [...new Set([1, Math.ceil(poolSize / 2), poolSize])];
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.rank)}`).join(" ");
  const shown = active ?? n - 1;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Évolution du rang sur ${poolSize} équipes, actuellement ${points[n - 1]?.rank}e`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {t === 1 ? "1er" : `${t}e`}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="axis" />
        <text x={PAD.left} y={H - 8} className="tick">{day(points[0].date)}</text>
        {n > 1 && (
          <text x={W - PAD.right} y={H - 8} className="tick" textAnchor="end">{day(points[n - 1].date)}</text>
        )}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />}
        <path d={path} className="line" />
        {points.map((p, i) => (
          <g key={p.date}>
            {/* Zone de survol plus large que le point. */}
            <rect
              x={x(i) - 12}
              y={PAD.top - 8}
              width={24}
              height={H - PAD.top - PAD.bottom + 16}
              fill="transparent"
              tabIndex={0}
              aria-label={`${day(p.date)} : ${p.rank}e`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
            <circle cx={x(i)} cy={y(p.rank)} r={i === shown ? 5 : 3.5} className="dot" pointerEvents="none" />
          </g>
        ))}
        <text
          x={Math.min(Math.max(x(shown), PAD.left + 30), W - PAD.right - 30)}
          y={y(points[shown].rank) - 10}
          className="value-label"
          textAnchor="middle"
        >
          {points[shown].rank === 1 ? "1er" : `${points[shown].rank}e`}
          {active !== null && ` · ${day(points[shown].date)}`}
        </text>
      </svg>
      <details className="chart-data">
        <summary>Voir les données</summary>
        <table>
          <thead><tr><th>Date</th><th>Rang</th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}><td>{day(p.date)}</td><td>{p.rank === 1 ? "1er" : `${p.rank}e`} / {poolSize}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
