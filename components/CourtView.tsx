"use client";

import { useEffect, useState } from "react";
import { placeOnCourt, SLOT_XY, type Slot } from "@/lib/domain/court";

export type RosterPlayer = { id: string; firstName: string; initials: string; position1: "setter" | "front" | "back" | null };

const SLOT_LABEL: Record<Slot, string> = { passe: "Passe", avantG: "Avant", avantD: "Avant", fond: "Fond" };

/**
 * Demi-terrain vu de dessus (filet en haut) : les joueurs arrivent un par un et glissent à leur poste.
 * Joueurs du même poste superposés ; sans poste, place au hasard (↻ pour retirer au sort).
 */
export function CourtView({ players }: { players: RosterPlayer[] }) {
  const [placement, setPlacement] = useState<Record<Slot, RosterPlayer[]> | null>(null);
  const [shown, setShown] = useState(false);
  const unknown = players.some((p) => !p.position1);

  const replay = () => {
    setShown(false);
    setPlacement(placeOnCourt(players));
    // Laisse le navigateur peindre la position de départ avant l'animation.
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  };
  useEffect(replay, [players]);

  let order = 0;
  return (
    <div className="stack">
      <div className="court" role="img" aria-label={courtLabel(placement)}>
        <span className="court-net" aria-hidden="true" />
        <span className="court-attack" aria-hidden="true" />
        {placement &&
          (Object.keys(SLOT_XY) as Slot[]).map((slot) => {
            const group = placement[slot];
            if (!group.length) return null;
            const { x, y } = SLOT_XY[slot];
            const delay = order++ * 0.18;
            return (
              <div
                key={slot}
                className={`court-slot${shown ? " is-in" : ""}`}
                style={{ left: shown ? `${x}%` : "50%", top: shown ? `${y}%` : "115%", transitionDelay: `${delay}s` }}
                aria-hidden="true"
              >
                <span className="court-stack">
                  {group.map((p, i) => (
                    <span key={p.id} className="court-dot" style={{ zIndex: group.length - i }}>
                      {p.initials}
                    </span>
                  ))}
                </span>
                <span className="court-names">{group.map((p) => p.firstName).join(" · ")}</span>
                <span className="court-role">{SLOT_LABEL[slot]}</span>
              </div>
            );
          })}
      </div>
      {unknown && (
        <button type="button" className="btn-secondary" onClick={replay}>
          ↻ Replacer les joueurs sans poste
        </button>
      )}
      <p className="muted small">
        Placés selon leur poste 1, au hasard s&apos;il n&apos;est pas renseigné. Plusieurs joueurs au même poste sont superposés.
      </p>
    </div>
  );
}

function courtLabel(placement: Record<Slot, RosterPlayer[]> | null) {
  if (!placement) return "Terrain";
  const part = (slot: Slot) => placement[slot].map((p) => p.firstName).join(", ");
  return `Terrain : passe ${part("passe") || "personne"} ; avants ${[part("avantG"), part("avantD")].filter(Boolean).join(", ") || "personne"} ; fond ${part("fond") || "personne"}.`;
}
