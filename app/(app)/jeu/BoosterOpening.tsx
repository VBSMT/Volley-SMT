"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerCard } from "@/components/game/PlayerCard";
import { type GameCard, GAME_POSITION_LABELS, cardKey, tierOf } from "@/lib/domain/game";
import { shortName } from "@/lib/format";
import { openStarter } from "./actions";

type Phase = "closed" | "shaking" | "dealt";

/** Ouverture animée du booster : le paquet tremble, éclate, puis les cartes se retournent au toucher. */
export function BoosterOpening({ size }: { size: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("closed");
  const [cards, setCards] = useState<GameCard[]>([]);
  const [shown, setShown] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (phase !== "closed") return;
    setError(null);
    setPhase("shaking");
    const [result] = await Promise.all([openStarter(), new Promise((r) => setTimeout(r, 700))]);
    if (!result.cards) {
      setError(result.error ?? "Ouverture impossible.");
      setPhase("closed");
      return;
    }
    setCards(result.cards);
    setFlash(true);
    setPhase("dealt");
    result.cards.forEach((_, i) => setTimeout(() => setShown(i + 1), 250 + 120 * i));
  }

  const reveal = (i: number) => setRevealed((r) => new Set(r).add(i));
  const revealAll = () => cards.forEach((_, i) => setTimeout(() => reveal(i), i * 180));
  const done = cards.length > 0 && revealed.size === cards.length;

  return (
    <div className="booster-stage">
      <p aria-live="polite" className="small">
        {phase === "dealt" ? (done ? `Ta collection compte ${cards.length} cartes !` : "Touche une carte pour la retourner") : "Touche le paquet pour l'ouvrir"}
      </p>
      {phase !== "dealt" ? (
        <button type="button" className={`booster-pack${phase === "shaking" ? " is-shaking" : ""}`} onClick={open} aria-label="Ouvrir le booster">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="44" />
            <path d="M50 6c-10 20-10 50 0 88M8 40c25 4 55 18 76 38M20 84c10-30 35-52 72-54" />
          </svg>
          <span className="booster-pack-label">
            VOLLEY SMT<small>{size} joueurs</small>
          </span>
        </button>
      ) : (
        <div className="booster-grid">
          {cards.map((c, i) => (
            <div
              key={cardKey(c)}
              className={`booster-slot${i < shown ? " is-in" : ""}${revealed.has(i) ? " is-revealed" : ""}${tierOf(c.rating) === "gold" ? " is-gold" : ""}`}
            >
              <button
                type="button"
                className="flip-card"
                onClick={() => reveal(i)}
                aria-label={revealed.has(i) ? `${shortName(c.firstName, c.lastName)}, ${GAME_POSITION_LABELS[c.position]}, ${c.rating}` : `Retourner la carte ${i + 1}`}
              >
                <span className="flip-face" aria-hidden="true">
                  <span className="flip-back-card">?</span>
                </span>
                <span className="flip-face flip-front" aria-hidden={!revealed.has(i)}>
                  <PlayerCard card={c} />
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {phase === "dealt" &&
        (done ? (
          <button type="button" className="btn-primary" onClick={() => router.refresh()}>
            Voir ma collection
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={revealAll}>
            Tout révéler
          </button>
        ))}
      <div className={`booster-flash${flash ? " is-on" : ""}`} onAnimationEnd={() => setFlash(false)} aria-hidden="true" />
    </div>
  );
}
