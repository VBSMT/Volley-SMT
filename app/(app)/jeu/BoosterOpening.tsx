"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerCard } from "@/components/game/PlayerCard";
import { type GameCard, GAME_POSITION_LABELS, cardKey, tierOf } from "@/lib/domain/game";
import { shortName } from "@/lib/format";

type Phase = "closed" | "shaking" | "open" | "done";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ouverture animée d'un booster : le paquet tremble et s'ouvre, puis les cartes sortent une à une,
 * face cachée. Toucher la carte la retourne ; toucher encore la range et fait sortir la suivante.
 */
export function BoosterOpening({ label, open, starter = false }: { label: string; starter?: boolean; open: () => Promise<{ cards?: GameCard[]; error?: string }> }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("closed");
  const [cards, setCards] = useState<GameCard[]>([]);
  const [index, setIndex] = useState(0); // carte en cours
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (phase !== "closed") return;
    setError(null);
    setPhase("shaking");
    const [result] = await Promise.all([open(), wait(600)]);
    if (!result.cards?.length) {
      setError(result.error ?? "Ouverture impossible.");
      return setPhase("closed");
    }
    setCards(result.cards);
    setPhase("open");
  }

  function tapCard() {
    if (!flipped) return setFlipped(true);
    setFlipped(false);
    if (index + 1 >= cards.length) setPhase("done");
    setIndex(index + 1);
  }

  const current = phase === "open" ? cards[index] : undefined;
  const out = cards.slice(0, phase === "done" ? cards.length : index);
  const status =
    phase === "done"
      ? starter
        ? `Ta collection compte ${cards.length} cartes !`
        : `${cards.length} nouvelles cartes !`
      : phase === "open"
        ? flipped
          ? `${index + 1} / ${cards.length} — touche la carte pour la suivante`
          : `${index + 1} / ${cards.length} — touche la carte pour la retourner`
        : "Touche le paquet pour l'ouvrir";

  return (
    <div className="booster-stage">
      <p aria-live="polite" className="small">{status}</p>
      {phase !== "done" && (
        <div className="booster-scene">
          {current && (
            <div key={index} className={`booster-current${tierOf(current.rating) === "gold" ? " is-gold" : ""}`}>
              <button
                type="button"
                className={`flip-card${flipped ? " is-flipped" : ""}`}
                onClick={tapCard}
                aria-label={
                  flipped
                    ? `${shortName(current.firstName, current.lastName)}, ${GAME_POSITION_LABELS[current.position]}, ${current.rating}. Carte suivante`
                    : `Retourner la carte ${index + 1}`
                }
              >
                <span className="flip-face" aria-hidden="true">
                  <span className="flip-back-card">?</span>
                </span>
                <span className="flip-face flip-front" aria-hidden="true">
                  <PlayerCard card={current} />
                </span>
              </button>
            </div>
          )}
          <button
            type="button"
            className={`booster-pack${phase === "shaking" ? " is-shaking" : ""}${phase === "open" ? " is-open" : ""}`}
            onClick={start}
            disabled={phase !== "closed"}
            aria-label="Ouvrir le booster"
          >
            <span className="booster-lid" />
            <span className="booster-body">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="44" />
                <path d="M50 6c-10 20-10 50 0 88M8 40c25 4 55 18 76 38M20 84c10-30 35-52 72-54" />
              </svg>
              <span className="booster-pack-label">
                VUT<small>{label}</small>
              </span>
            </span>
          </button>
          <span className="booster-glow" aria-hidden="true" />
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {out.length > 0 && (
        <ul className="booster-pile" aria-label="Cartes obtenues">
          {out.map((c) => (
            <li key={cardKey(c)}>
              <PlayerCard card={c} />
            </li>
          ))}
        </ul>
      )}
      {phase === "open" && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setPhase("done");
            setIndex(cards.length);
          }}
        >
          Tout révéler
        </button>
      )}
      {phase === "done" && (
        <div className="action-row">
          <button type="button" className="btn-primary" onClick={() => router.push("/jeu?vue=collection")}>
            Ma collection
          </button>
          {!starter && (
            <button type="button" className="btn-secondary" onClick={() => router.refresh()}>
              Mes boosters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
