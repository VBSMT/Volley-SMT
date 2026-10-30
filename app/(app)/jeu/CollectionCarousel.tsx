"use client";

import { useState } from "react";
import { PlayerCard } from "@/components/game/PlayerCard";
import { useWheel } from "@/components/game/useWheel";
import { type GameCard, type GamePosition, GAME_POSITIONS, GAME_POSITION_LABELS, LEGEND_BONUS_LABELS, cardKey, isSpecial } from "@/lib/domain/game";
import { shortName } from "@/lib/format";

type Entry = { card: GameCard; copies: number; gifted?: boolean };
const SHORT: Record<string, string> = { setter: "Passe", front_left: "Av. (4)", front_right: "Av. (2)", back: "Fond", all: "Tous", rare: "★ Rares", captain: "C Capitaines", legend: "♛ Légendes" };
const STEP = 90;

/**
 * Collection en carrousel 3D : la carte du centre est de face, les voisines tournent sur les
 * côtés ; glisser pour tourner, toucher une voisine pour l'amener au centre, toucher la carte
 * du centre pour la retourner (équipe, record, exemplaires).
 */
export function CollectionCarousel({
  entries,
  total,
  bare = false,
  initialKey,
}: {
  entries: Entry[];
  total: number;
  /** Ouvert depuis l'album : sans compteur, tri ni filtres. */
  bare?: boolean;
  /** Carte à afficher au centre à l'ouverture. */
  initialKey?: string;
}) {
  const [filter, setFilter] = useState<GamePosition | "all" | "rare" | "captain" | "legend">("all");
  const [sort, setSort] = useState<"rating" | "team">("rating");
  const [flipped, setFlipped] = useState<string | null>(null);
  const list = entries
    .filter((e) => filter === "all" || (filter === "rare" || filter === "captain" || filter === "legend" ? e.card.kind === filter : !isSpecial(e.card) && e.card.position === filter))
    .sort((a, b) => (sort === "rating" ? b.card.rating - a.card.rating : a.card.teamName.localeCompare(b.card.teamName, "fr")));
  const wheel = useWheel(list.length, STEP, {
    onTap: (i) => {
      if (i !== Math.round(wheel.center)) {
        setFlipped(null);
        return wheel.setCenter(i);
      }
      const key = cardKey(list[i].card);
      setFlipped((f) => (f === key ? null : key));
    },
  });
  const current = list[Math.round(wheel.center)];
  // Ouverture depuis l'album : centrer la carte touchée (une seule fois).
  const [centered, setCentered] = useState(false);
  if (!centered && initialKey) {
    setCentered(true);
    const i = list.findIndex((e) => cardKey(e.card) === initialKey);
    if (i >= 0) wheel.setCenter(i);
  }

  return (
    <div className="stack">
      {!bare && (
        <>
      <div className="collection-head">
        <strong className="collection-count">
          {entries.length} <span className="small muted">/ {total}</span>
        </strong>
        <label className="small">
          Tri{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value as "rating" | "team")}>
            <option value="rating">par note</option>
            <option value="team">par équipe</option>
          </select>
        </label>
      </div>
      <div className="chip-row" role="group" aria-label="Filtrer par poste">
        {(["all", ...GAME_POSITIONS, "rare", "captain", "legend"] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`chip${filter === p ? " is-on" : ""}`}
            aria-pressed={filter === p}
            onClick={() => {
              setFilter(p);
              setFlipped(null);
              wheel.setCenter(Infinity);
            }}
          >
            {SHORT[p]}
          </button>
        ))}
      </div>
        </>
      )}
      <div className="carousel" aria-roledescription="carrousel" aria-label="Ma collection : glisser pour tourner">
        {list.length === 0 && <p className="small">Aucune carte à ce poste.</p>}
        {list.map((e, i) => {
          const offset = i - wheel.center;
          const far = Math.abs(offset);
          if (far > 3.5) return null;
          const key = cardKey(e.card);
          const isCenter = i === Math.round(wheel.center);
          return (
            <button
              key={key}
              type="button"
              className={`carousel-card${wheel.dragging ? " is-spinning" : ""}`}
              style={{
                transform: `translateX(${offset * STEP}px) translateZ(${-far * 90}px) rotateY(${Math.max(-60, Math.min(60, -offset * 38))}deg)`,
                zIndex: 100 - Math.round(far * 10),
                opacity: Math.max(0.25, 1 - far * 0.25),
              }}
              onPointerDown={wheel.onPointerDown(i)}
              {...wheel.handlers}
              aria-label={`${shortName(e.card.firstName, e.card.lastName)}, ${GAME_POSITION_LABELS[e.card.position]}, ${e.card.teamName}, ${e.card.rating}${e.copies > 1 ? `, ${e.copies} exemplaires` : ""}${isCenter ? ", toucher pour retourner" : ""}`}
            >
              <span className={`flip-card${flipped === key ? " is-flipped" : ""}`} aria-hidden="true">
                <span className="flip-face">
                  <PlayerCard card={e.card} copies={e.copies} />
                </span>
                <span className="flip-face flip-front">
                  <span className="card-back-info">
                    <strong>{shortName(e.card.firstName, e.card.lastName)}</strong>
                    <span>{e.card.kind === "captain" ? "Capitaine" : e.card.kind === "legend" ? "Légende" : GAME_POSITION_LABELS[e.card.position]}</span>
                    {e.card.kind === "rare" && <span>★ Rare (2ᵉ poste)</span>}
                    {e.card.kind === "captain" && <span>+5 % du total, +10 % si son équipe gagne</span>}
                    {e.card.legendBonus && <span>{LEGEND_BONUS_LABELS[e.card.legendBonus]}</span>}
                    <span>{e.card.teamName}</span>
                    <span>Note : {e.card.rating}</span>
                    <span>Record : {e.card.bestRating}</span>
                    <span>
                      {e.copies} exemplaire{e.copies > 1 ? "s" : ""}
                    </span>
                    {e.gifted && <span className="gift-mention">🎁 Cadeau</span>}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {current && (
        <p className="small muted collection-hint">
          {Math.round(wheel.center) + 1} / {list.length} — glisse pour tourner, touche la carte pour la retourner
        </p>
      )}
    </div>
  );
}
