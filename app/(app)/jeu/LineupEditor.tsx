"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { PlayerCard } from "@/components/game/PlayerCard";
import { type GameCard, GAME_POSITION_LABELS, cardKey } from "@/lib/domain/game";
import { type Lineup, type Slot, SLOTS, lineupErrors } from "@/lib/domain/game-week";
import { saveLineup } from "./actions";

const SLOT_LABELS: Record<Slot, string> = { ...GAME_POSITION_LABELS, sub: "Remplaçant" };
const fits = (card: GameCard, slot: Slot) => slot === "sub" || card.position === slot;

/**
 * Équipe de la semaine sur un terrain : la main de cartes en bas ; toucher une carte la sélectionne
 * (elle remonte), toucher une place l'y pose ; on peut aussi glisser la carte jusqu'à sa place.
 * Toucher une carte posée la remet dans la main. Cartes verrouillées au début du match de leur équipe.
 */
export function LineupEditor({
  owned,
  initial,
  lockedTeams,
  playingTeams,
  validated,
}: {
  owned: GameCard[];
  initial: Lineup;
  lockedTeams: string[];
  playingTeams: string[];
  validated: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [lineup, setLineup] = useState<Lineup>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ key: string; x: number; y: number } | null>(null);
  const start = useRef<{ key: string; x: number; y: number; moved: boolean } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const locked = new Set(lockedTeams);
  const playing = new Set(playingTeams);
  const byKey = new Map(owned.map((c) => [cardKey(c), c]));
  const placed = new Set(SLOTS.flatMap((s) => (lineup[s] ? [cardKey(lineup[s]!)] : [])));
  const hand = owned.filter((c) => !placed.has(cardKey(c))).sort((a, b) => a.position.localeCompare(b.position) || b.rating - a.rating);
  const errors = lineupErrors(lineup, owned);
  const changed = JSON.stringify(lineup) !== JSON.stringify(initial);
  const slotLocked = (slot: Slot) => !!lineup[slot] && locked.has(lineup[slot]!.teamId);
  const active = drag?.key ?? selected;
  const activeCard = active ? byKey.get(active) : undefined;

  function place(key: string, slot: Slot) {
    const card = byKey.get(key);
    if (!card || slotLocked(slot) || locked.has(card.teamId)) return;
    if (!fits(card, slot)) return setError(`${GAME_POSITION_LABELS[card.position]} : cette carte ne va pas en ${SLOT_LABELS[slot]}.`);
    setError(undefined);
    setLineup((l) => ({ ...l, [slot]: { memberId: card.memberId, teamId: card.teamId } }));
    setSelected(null);
  }

  function unplace(slot: Slot) {
    if (slotLocked(slot)) return;
    setLineup((l) => {
      const next = { ...l };
      delete next[slot];
      return next;
    });
  }

  // Glisser-déposer (doigt ou souris) : au-delà de 8 px, la carte suit le doigt.
  const onDown = (key: string) => (e: React.PointerEvent) => {
    if (pending || locked.has(byKey.get(key)?.teamId ?? "")) return;
    start.current = { key, x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) {
      s.moved = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
    if (s.moved) setDrag({ key: s.key, x: e.clientX, y: e.clientY });
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (!s.moved) return setSelected((k) => (k === s.key ? null : s.key));
    setDrag(null);
    const target = document.elementsFromPoint(e.clientX, e.clientY).find((el) => (el as HTMLElement).dataset?.slot);
    if (target) place(s.key, (target as HTMLElement).dataset.slot as Slot);
  };

  const save = async () => {
    const ok = await confirm(validated ? "Enregistrer les changements ?" : "Valider mon équipe de la semaine ?", {
      text: "Chaque carte se verrouille au début du match de son équipe.",
      confirmLabel: validated ? "Enregistrer" : "Valider",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await saveLineup(lineup);
      if (r.error) return setError(r.error);
      setError(undefined);
      const before = initial;
      toast({
        message: "Équipe enregistrée.",
        undo: lineupErrors(before, owned).length
          ? undefined
          : async () => {
              const u = await saveLineup(before);
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

  const spot = (slot: Slot) => {
    const pick = lineup[slot];
    const card = pick ? byKey.get(cardKey(pick)) : undefined;
    const target = activeCard && !card && fits(activeCard, slot) && !locked.has(activeCard.teamId);
    return (
      <div key={slot} className={`court-spot court-spot-${slot}${target ? " is-target" : ""}`}>
        <button
          type="button"
          data-slot={slot}
          className="court-spot-btn"
          disabled={pending || slotLocked(slot)}
          onClick={() => (selected ? place(selected, slot) : card && unplace(slot))}
          aria-label={
            card
              ? `${SLOT_LABELS[slot]} : ${card.firstName} ${card.lastName[0]}.${slotLocked(slot) ? ", verrouillée" : ", toucher pour retirer"}`
              : `${SLOT_LABELS[slot]} : vide${selected ? ", toucher pour poser la carte" : ""}`
          }
        >
          {card ? (
            <span className="mini-card" aria-hidden="true">
              <PlayerCard card={card} />
            </span>
          ) : (
            <span className="court-spot-empty" aria-hidden="true">
              {SLOT_LABELS[slot]}
            </span>
          )}
        </button>
        {card && slotLocked(slot) && <span className="court-flag">🔒</span>}
        {card && !slotLocked(slot) && !playing.has(card.teamId) && <span className="court-flag" title={`${card.teamName} ne joue pas cette semaine`}>⚠</span>}
      </div>
    );
  };

  const absent = SLOTS.flatMap((s) => {
    const c = lineup[s] && byKey.get(cardKey(lineup[s]!));
    return c && !playing.has(c.teamId) ? [c.teamName] : [];
  });

  return (
    <div className="stack">
      {dialog}
      <div className="lineup-court">
        <div className="court-net" aria-hidden="true" />
        {(["front_left", "setter", "front_right", "back"] as Slot[]).map(spot)}
      </div>
      <div className="lineup-bench">{spot("sub")}<span className="small">Remplaçant : 50 % des points, 100 % s&apos;il remplace un titulaire qui n&apos;a pas joué.</span></div>

      {[...new Set(absent)].map((t) => (
        <p key={t} className="small warning-text">⚠ {t} ne joue pas cette semaine.</p>
      ))}
      {errors.length > 0 && (
        <ul className="small">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn-primary" disabled={pending || errors.length > 0 || (validated && !changed)} onClick={save}>
        {pending ? "Enregistrement…" : validated ? "Enregistrer les changements" : "Valider mon équipe"}
      </button>

      <div className="hand" aria-label="Ma main : toucher une carte puis une place, ou la glisser">
        {hand.length === 0 && <p className="small">Toutes tes cartes sont sur le terrain.</p>}
        {hand.map((c, i) => {
          const key = cardKey(c);
          // Éventail : rotation et léger arrondi selon la place de la carte dans la main.
          const offset = i - (hand.length - 1) / 2;
          const isLocked = locked.has(c.teamId);
          return (
            <button
              key={key}
              type="button"
              className={`hand-card${selected === key ? " is-selected" : ""}${drag?.key === key ? " is-dragging" : ""}`}
              disabled={pending || isLocked}
              style={{ "--angle": `${offset * Math.min(6, 40 / hand.length)}deg`, "--drop": `${Math.abs(offset) ** 1.6 * 1.5}px` } as React.CSSProperties}
              onPointerDown={onDown(key)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => {
                start.current = null;
                setDrag(null);
              }}
              aria-pressed={selected === key}
              aria-label={`${c.firstName} ${c.lastName[0]}., ${GAME_POSITION_LABELS[c.position]}, ${c.teamName}, ${c.rating}${isLocked ? ", verrouillée" : ""}`}
            >
              <span className="mini-card" aria-hidden="true">
                <PlayerCard card={c} />
              </span>
            </button>
          );
        })}
      </div>
      {drag && activeCard && (
        <div className="vut-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <span className="mini-card">
            <PlayerCard card={activeCard} />
          </span>
        </div>
      )}
    </div>
  );
}
