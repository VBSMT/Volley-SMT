"use client";

import { useState } from "react";

type Point = { name: string; scored: number; conceded: number; mine: boolean };

const W = 340;
const H = 260;
const PAD = { top: 24, right: 14, bottom: 34, left: 30 };
const dec = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const short = (name: string) => name.replace(/^SMDT\s*\/\s*/i, "");

/**
 * Attaque (points marqués par set, de gauche à droite) et défense (points encaissés par set,
 * en haut = moins encaissés) des équipes de la poule. Notre équipe en couleur du texte, les autres en retrait.
 */
export function AttackDefense({ points }: { points: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) return null;
  const xs = points.map((p) => p.scored);
  const ys = points.map((p) => p.conceded);
  const x0 = Math.floor(Math.min(...xs) - 0.5);
  const x1 = Math.ceil(Math.max(...xs) + 0.5);
  const y0 = Math.floor(Math.min(...ys) - 0.5);
  const y1 = Math.ceil(Math.max(...ys) + 0.5);
  const x = (v: number) => PAD.left + ((v - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + ((v - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom); // moins encaissé = en haut
  const xTicks = Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i);
  const yTicks = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
  const extremes = new Set([
    points.reduce((a, b) => (a.scored - a.conceded > b.scored - b.conceded ? a : b)).name,
    points.reduce((a, b) => (a.scored - a.conceded < b.scored - b.conceded ? a : b)).name,
  ]);
  const shown = active !== null ? points[active] : null;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Points marqués et encaissés par set, par équipe">
        <text x={PAD.left} y={12} className="tick">↑ encaissés par set (en haut = moins encaissés)</text>
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={H - PAD.bottom} className="grid" />
            <text x={x(t)} y={H - PAD.bottom + 14} className="tick" textAnchor="middle">{t}</text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 6} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}
        <text x={(W + PAD.left) / 2} y={H - 4} className="tick" textAnchor="middle">marqués par set →</text>
        {points.map((p, i) => {
          const cx = x(p.scored);
          const cy = y(p.conceded);
          const right = cx > W * 0.6;
          return (
            <g key={p.name}>
              <circle cx={cx} cy={cy} r={p.mine ? 8 : 6} className={p.mine ? "dot" : "dot dot-other"} />
              {(p.mine || extremes.has(p.name)) && (
                <text x={cx + (right ? -12 : 12)} y={cy} dominantBaseline="middle" textAnchor={right ? "end" : "start"} className={p.mine ? "value-label" : "tick"}>
                  {p.mine ? "Nous" : short(p.name).split("/")[0]}
                </text>
              )}
              <circle
                cx={cx}
                cy={cy}
                r={16}
                fill="transparent"
                tabIndex={0}
                aria-label={`${short(p.name)} : ${dec(p.scored)} marqués, ${dec(p.conceded)} encaissés par set`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(i)}
              />
            </g>
          );
        })}
      </svg>
      <p className="chart-tooltip small" aria-live="polite">
        {shown
          ? `${short(shown.name)} : ${dec(shown.scored)} marqués · ${dec(shown.conceded)} encaissés par set`
          : "En haut à droite : attaque forte et défense solide. Touchez un point pour le détail."}
      </p>
      <p className="winloss-legend">
        <span><i className="dot-mine" aria-hidden="true" /> Notre équipe</span>
        <span><i className="dot-other-legend" aria-hidden="true" /> Autres équipes</span>
      </p>
      <details className="chart-data">
        <summary>Voir en tableau</summary>
        <table>
          <thead><tr><th>Équipe</th><th>Marqués/set</th><th>Encaissés/set</th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.name}><td>{short(p.name)}</td><td>{dec(p.scored)}</td><td>{dec(p.conceded)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
