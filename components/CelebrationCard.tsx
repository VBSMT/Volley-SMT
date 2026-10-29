"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Celebration } from "@/lib/stats";

const KEY = (c: Celebration) => `bravo-${c.teamId}-${c.takenOn}`;
const COLORS = ["#FFE81A", "#0ca30c", "#ffffff", "#FFE81A", "#bdbdbd"];

/** Confettis : courte pluie animée à l'affichage (fixes si le téléphone réduit les animations). */
function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.4 + Math.random() * 1.8,
      rotate: Math.random() * 360,
      drift: (Math.random() - 0.5) * 60,
      color: COLORS[i % COLORS.length],
      top: Math.random() * 100,
    })),
  );
  return (
    <span className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={
            {
              left: `${p.left}%`,
              top: `${p.top}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--r": `${p.rotate}deg`,
              "--dx": `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/** « Bravo aux Bras Cassés », « à la Meute », « au … », « à Totally Spike ». */
export const bravoTo = (name: string) =>
  /^les\s/i.test(name) ? `aux ${name.slice(4)}` : /^la\s/i.test(name) ? `à la ${name.slice(3)}` : /^le\s/i.test(name) ? `au ${name.slice(3)}` : `à ${name}`;

const ago = (takenOn: string) => {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  return takenOn === today ? "HIER SOIR" : "AVANT-HIER";
};

/** Félicitations éphémères (48 h) pour une victoire d'une équipe du club ; fermable (×), mémorisé sur l'appareil. */
export function CelebrationCards({ items }: { items: Celebration[] }) {
  const [hidden, setHidden] = useState<Set<string> | null>(null);
  useEffect(() => {
    const h = new Set<string>();
    for (const c of items) {
      try {
        if (localStorage.getItem(KEY(c))) h.add(KEY(c));
      } catch {}
    }
    setHidden(h);
  }, [items]);
  if (!hidden) return null;

  return items
    .filter((c) => !hidden.has(KEY(c)))
    .map((c) => (
      <section key={KEY(c)} className="bravo" aria-label={`Félicitations à ${c.teamName}`}>
        <Confetti />
        <div className="bravo-top">
          <span className="bravo-tag">VICTOIRE · {ago(c.takenOn)}</span>
          <button
            type="button"
            className="bravo-close"
            aria-label="Masquer ce message"
            onClick={() => {
              try {
                localStorage.setItem(KEY(c), "1");
              } catch {}
              setHidden(new Set([...hidden, KEY(c)]));
            }}
          >
            ×
          </button>
        </div>
        <h2>Bravo {bravoTo(c.teamName)} ! 🎉</h2>
        {(c.score || c.opponent) && (
          <p className="bravo-score">
            {c.score && c.score !== "forfait" ? c.score.replace("-", " – ") : c.score === "forfait" ? "Forfait" : ""}
            {c.opponent && (
              <small>
                {" "}
                contre {c.opponent}
                {c.isHome !== null && ` · ${c.isHome ? "à domicile" : "à l'extérieur"}`}
              </small>
            )}
          </p>
        )}
        <p className="bravo-meta">
          {c.streak > 1 && <>{c.streak}ᵉ victoire de suite · </>}
          {c.rank === 1 ? "1ᵉʳ" : `${c.rank}ᵉ`} de la poule
          {c.rankDelta > 0 && ` (▲ ${c.rankDelta})`}
        </p>
        <Link href={`/stats?equipe=${c.teamId}`} className="bravo-link">
          Voir les stats de l&apos;équipe →
        </Link>
      </section>
    ));
}
