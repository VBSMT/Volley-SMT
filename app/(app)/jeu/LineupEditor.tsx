"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { PlayerCard } from "@/components/game/PlayerCard";
import { useWheel } from "@/components/game/useWheel";
import { type GameCard, type GamePosition, GAME_POSITIONS, GAME_POSITION_LABELS, cardKey, isSpecial, tierOf } from "@/lib/domain/game";
import { type Lineup, type Slot, SLOTS, lineupErrors } from "@/lib/domain/game-week";
import { saveLineup } from "./actions";

const SLOT_LABELS: Record<Slot, string> = { ...GAME_POSITION_LABELS, sub: "Remplaçant", bonus: "Bonus" };
const SHORT: Record<string, string> = { setter: "Passe", front_left: "Av. (4)", front_right: "Av. (2)", back: "Fond", bonus: "Bonus", all: "Tous" };
// Case Bonus : Capitaine ou Légende ; autres places : communes et rares (le remplaçant de tout poste).
const fits = (card: GameCard, slot: Slot) => (slot === "bonus" ? isSpecial(card) : !isSpecial(card) && (slot === "sub" || card.position === slot));
const homeSlot = (card: GameCard): Slot => (isSpecial(card) ? "bonus" : card.position);
const STEP = 46; // pixels par carte dans la main

/**
 * Équipe de la semaine, tout sur un écran : terrain (remplaçant dans le coin) et main en roue.
 * Glisser la main la fait tourner ; toucher la carte du centre la pose à son poste (ou à la place
 * choisie), toucher une autre carte l'amène au centre ; glisser la carte du centre vers le haut
 * permet de la déposer. Toucher une place vide filtre la main sur ce poste ; toucher une carte
 * posée la remet en main. Cartes verrouillées au début du match de leur équipe.
 */
export function LineupEditor({
  owned,
  initial,
  lockedTeams,
  playingTeams,
  validated,
  points,
  week,
  readOnly = false,
  previous,
}: {
  owned: GameCard[];
  initial: Lineup;
  lockedTeams: string[];
  playingTeams: string[];
  validated: boolean;
  points: number | null;
  week: string;
  /** Journée passée : consultation seulement. */
  readOnly?: boolean;
  /** Compo de la journée précédente (bouton « Reprendre la compo précédente »). */
  previous?: Lineup;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [lineup, setLineup] = useState<Lineup>(initial);
  const [filter, setFilter] = useState<GamePosition | "bonus" | "all">("all");
  const [target, setTarget] = useState<Slot | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [landed, setLanded] = useState<Slot | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const locked = new Set(lockedTeams);
  const playing = new Set(playingTeams);
  const byKey = new Map(owned.map((c) => [cardKey(c), c]));
  const placed = new Set(SLOTS.flatMap((s) => (lineup[s] ? [cardKey(lineup[s]!)] : [])));
  const hand = owned
    .filter((c) => !placed.has(cardKey(c)) && (filter === "all" || (filter === "bonus" ? isSpecial(c) : !isSpecial(c) && c.position === filter)))
    .sort((a, b) => Number(isSpecial(a)) - Number(isSpecial(b)) || GAME_POSITIONS.indexOf(a.position) - GAME_POSITIONS.indexOf(b.position) || b.rating - a.rating);
  const errors = lineupErrors(lineup, owned).filter((e) => e !== "Il faut un joueur à chaque poste.");
  const complete = SLOTS.slice(0, 4).every((s) => lineup[s]);
  const changed = JSON.stringify(lineup) !== JSON.stringify(initial);
  // Case Bonus : verrouillée dès le premier match d'un titulaire (déjà enregistré) ; autres places : au match de la carte.
  const bonusIsLocked = SLOTS.slice(0, 4).some((s) => initial[s] && locked.has(initial[s]!.teamId));
  const slotLocked = (slot: Slot) => (slot === "bonus" ? bonusIsLocked : !!lineup[slot] && locked.has(lineup[slot]!.teamId));

  function place(card: GameCard, slot: Slot) {
    if (readOnly) return;
    if (slotLocked(slot) || locked.has(card.teamId)) return setError("Carte verrouillée : le match de son équipe a commencé.");
    if (!fits(card, slot)) return setError(isSpecial(card) ? "Capitaines et Légendes vont dans la case Bonus." : slot === "bonus" ? "La case Bonus accueille un Capitaine ou une Légende." : `Cette carte joue ${GAME_POSITION_LABELS[card.position]}.`);
    setError(undefined);
    setLineup((l) => ({ ...l, [slot]: { memberId: card.memberId, teamId: card.teamId, kind: card.kind ?? "common" } }));
    setLanded(slot);
    setTarget(null);
    setFilter("all");
  }

  const wheel = useWheel(hand.length, STEP, {
    onTap: (i) => {
      if (i !== Math.round(wheel.center)) return wheel.setCenter(i);
      const card = hand[i];
      if (card) place(card, target && fits(card, target) ? target : homeSlot(card));
    },
    onLift: (e, phase) => {
      if (phase === "move") return setGhost({ x: e.clientX, y: e.clientY });
      setGhost(null);
      // Relâchée hors d'une place : la carte retourne simplement dans la main.
      const el = document.elementsFromPoint(e.clientX, e.clientY).find((x) => (x as HTMLElement).dataset?.slot) as HTMLElement | undefined;
      const card = hand[Math.round(wheel.center)];
      if (el && card) place(card, el.dataset.slot as Slot);
    },
  });
  const centerCard = hand[Math.round(wheel.center)];

  // Filet de sécurité : la carte fantôme disparaît à tout relâché (doigt sorti, défilement…).
  useEffect(() => {
    if (!ghost) return;
    const clear = () => setGhost(null);
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    window.addEventListener("scroll", clear, { passive: true });
    return () => {
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
      window.removeEventListener("scroll", clear);
    };
  }, [ghost]);

  function tapSlot(slot: Slot) {
    if (readOnly || slotLocked(slot)) return;
    if (lineup[slot]) {
      setLineup((l) => {
        const next = { ...l };
        delete next[slot];
        return next;
      });
      return;
    }
    setTarget(slot);
    setFilter(slot === "sub" ? "all" : slot);
    wheel.setCenter(Infinity);
  }

  // Reprend la compo de la journée précédente : seulement les cartes encore possédées et libres.
  function copyPrevious() {
    if (!previous) return;
    const next: Lineup = {};
    for (const slot of SLOTS) {
      const pick = previous[slot];
      const card = pick && byKey.get(cardKey(pick));
      if (pick && card && !locked.has(card.teamId) && !slotLocked(slot)) next[slot] = pick;
      else if (lineup[slot] && slotLocked(slot)) next[slot] = lineup[slot];
    }
    setLineup(next);
    setError(undefined);
  }

  const save = async () => {
    const ok = await confirm(validated ? "Enregistrer les changements ?" : "Valider mon équipe de la semaine ?", {
      text: "Chaque carte se verrouille au début du match de son équipe.",
      confirmLabel: validated ? "Enregistrer" : "Valider",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await saveLineup(lineup, week);
      if (r.error) return setError(r.error);
      setError(undefined);
      setCelebrate((n) => n + 1);
      const before = initial;
      toast({
        message: "Équipe enregistrée.",
        undo: lineupErrors(before, owned).length
          ? undefined
          : async () => {
              const u = await saveLineup(before, week);
              if (!u.error) {
                setLineup(before);
                router.refresh();
              }
              return u;
            },
      });
      router.refresh();
    });
  };

  const spot = (slot: Slot, order: number) => {
    const pick = lineup[slot];
    const card = pick ? byKey.get(cardKey(pick)) : undefined;
    const isTarget = !card && (target === slot || (centerCard && fits(centerCard, slot) && !slotLocked(slot) && slot !== "sub"));
    return (
      <div key={slot} className={`court-spot court-spot-${slot}${isTarget ? " is-target" : ""}`}>
        {(slot === "sub" || slot === "bonus") && <span className="court-sub-label" aria-hidden="true">{SLOT_LABELS[slot]}</span>}
        <button
          type="button"
          data-slot={slot}
          className="court-spot-btn"
          disabled={pending || slotLocked(slot)}
          onClick={() => tapSlot(slot)}
          aria-label={
            card
              ? `${SLOT_LABELS[slot]} : ${card.firstName} ${card.lastName[0]}.${slotLocked(slot) ? ", verrouillée" : ", toucher pour remettre en main"}`
              : `${SLOT_LABELS[slot]} : vide, toucher pour choisir`
          }
        >
          {card ? (
            <span
              key={`${cardKey(card)}-${celebrate}`}
              className={`mini-card${landed === slot ? " is-landing" : ""}${tierOf(card.rating) === "gold" && landed === slot ? " is-gold" : ""}${celebrate && slot !== "sub" ? " is-celebrating" : ""}`}
              style={{ "--order": order } as React.CSSProperties}
              aria-hidden="true"
              onAnimationEnd={() => landed === slot && setLanded(null)}
            >
              <PlayerCard card={card} />
            </span>
          ) : (
            <span className="court-spot-empty" aria-hidden="true">
              {slot === "sub" || slot === "bonus" ? "" : SHORT[slot]}
            </span>
          )}
        </button>
        {card && slotLocked(slot) && <span className="court-flag">🔒</span>}
        {card && card.kind !== "legend" && !slotLocked(slot) && !playing.has(card.teamId) && (
          <span className="court-flag" title={`${card.teamName} ne joue pas cette semaine`}>⚠</span>
        )}
      </div>
    );
  };

  const absent = [...new Set(SLOTS.flatMap((s) => {
    const c = lineup[s] && byKey.get(cardKey(lineup[s]!));
    // Une Légende n'a pas d'équipe : pas d'alerte « sans match ».
    return c && c.kind !== "legend" && !playing.has(c.teamId) ? [c.teamName] : [];
  }))];

  return (
    <div className="lineup-screen">
      {dialog}
      <div className="lineup-status" aria-live="polite">
        {!readOnly && (
          <button
            type="button"
            className="court-validate"
            disabled={pending || !complete || errors.length > 0 || (validated && !changed)}
            onClick={save}
          >
            {pending ? "…" : validated ? (changed ? "Enregistrer" : "✓ Validée") : "Valider"}
          </button>
        )}
        {!readOnly && previous && Object.keys(previous).length > 0 && (
          <button type="button" className="chip" onClick={copyPrevious} disabled={pending}>
            ↺ Reprendre la compo précédente
          </button>
        )}

        {points !== null && (
          <span className="pill pill-score">
            <Counter value={points} /> pts
          </span>
        )}
        {errors.map((e) => (
          <span key={e} className="pill pill-warn">⚠ {e}</span>
        ))}
        {absent.length > 0 && (
          <span className="pill">
            ⚠ Sans match cette semaine : {absent.join(", ")}
          </span>
        )}
        {error && <span className="pill pill-warn" role="alert">{error}</span>}
      </div>

      <div className="lineup-court">
        <div className="court-net" aria-hidden="true" />
        {(["front_left", "setter", "front_right", "back", "sub", "bonus"] as Slot[]).map((s, i) => spot(s, i))}
      </div>

      {!readOnly && (
      <div className="hand-zone">
        <div className="chip-row" role="group" aria-label="Filtrer la main par poste">
          {(["all", ...GAME_POSITIONS, "bonus"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`chip${filter === p ? " is-on" : ""}`}
              aria-pressed={filter === p}
              onClick={() => {
                setFilter(p);
                setTarget(null);
                wheel.setCenter(Infinity);
              }}
            >
              {SHORT[p]}
            </button>
          ))}
        </div>
        <div className="hand-wheel" aria-label="Ma main : glisser pour faire tourner, toucher la carte du centre pour la poser">
          {hand.length === 0 && <p className="small">Aucune carte ici.</p>}
          {hand.map((c, i) => {
            const offset = i - wheel.center;
            const far = Math.abs(offset);
            if (far > 4.5) return null;
            const isCenter = i === Math.round(wheel.center);
            return (
              <button
                key={cardKey(c)}
                type="button"
                className={`wheel-card${isCenter ? " is-center" : ""}${wheel.dragging ? " is-spinning" : ""}${ghost && isCenter ? " is-lifted" : ""}`}
                disabled={pending || locked.has(c.teamId)}
                style={{
                  transform: `translateX(${offset * STEP}px) translateY(${far * far * 3 - (isCenter ? 10 : 0)}px) rotate(${offset * 7}deg) scale(${Math.max(0.7, 1 - far * 0.08)})`,
                  zIndex: 100 - Math.round(far * 10),
                }}
                onPointerDown={wheel.onPointerDown(i)}
                {...wheel.handlers}
                aria-label={`${c.firstName} ${c.lastName[0]}., ${GAME_POSITION_LABELS[c.position]}, ${c.teamName}, ${c.rating}${isCenter ? ", toucher pour poser" : ""}`}
              >
                <span className="mini-card" aria-hidden="true">
                  <PlayerCard card={c} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
      )}
      {ghost && centerCard && (
        <div className="vut-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <span className="mini-card">
            <PlayerCard card={centerCard} />
          </span>
        </div>
      )}
    </div>
  );
}

/** Score qui défile de 0 jusqu'à sa valeur (respecte « réduire les animations »). */
function Counter({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(value);
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      setShown(Math.round(value * (1 - (1 - k) ** 3) * 10) / 10);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}
