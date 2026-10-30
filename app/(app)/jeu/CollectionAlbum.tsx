"use client";

import { useState } from "react";
import { PlayerCard } from "@/components/game/PlayerCard";
import { type GameCard, type GamePosition, GAME_POSITIONS, GAME_POSITION_LABELS, cardKey } from "@/lib/domain/game";
import { shortName } from "@/lib/format";

type Entry = { card: GameCard; copies: number };
type Group = "team" | "position" | "kind";

const GROUPS: [Group, string][] = [
  ["team", "Équipe"],
  ["position", "Poste"],
  ["kind", "Rareté"],
];
const KINDS = [
  ["common", "Communes"],
  ["rare", "★ Rares"],
  ["captain", "C Capitaines"],
  ["legend", "♛ Légendes"],
] as const;

/** Rubrique d'une carte selon le rangement choisi. */
function sectionOf(c: GameCard, group: Group): string {
  if (group === "team") return c.kind === "legend" ? "Bureau" : c.teamName;
  if (group === "kind") return c.kind ?? "common";
  return c.kind === "captain" || c.kind === "legend" ? "special" : c.position;
}
function sectionTitle(key: string, group: Group): string {
  if (group === "kind") return KINDS.find(([k]) => k === key)?.[1] ?? key;
  if (group === "position") return key === "special" ? "Capitaines & Légendes" : GAME_POSITION_LABELS[key as GamePosition];
  return key;
}
function sectionOrder(group: Group, keys: string[]): string[] {
  if (group === "kind") return KINDS.map(([k]) => k).filter((k) => keys.includes(k));
  if (group === "position") return [...GAME_POSITIONS, "special"].filter((k) => keys.includes(k));
  return [...keys].sort((a, b) => (a === "Bureau" ? 1 : b === "Bureau" ? -1 : a.localeCompare(b, "fr")));
}

/**
 * Collection en album : grille de petites cartes rangées par équipe, poste ou rareté, avec les
 * cartes manquantes en gris (« ? ») et un compteur par rubrique ; toucher une carte l'ouvre en grand.
 */
export function CollectionAlbum({ entries, all, onOpen }: { entries: Entry[]; all: GameCard[]; onOpen: (key: string, keys: string[]) => void }) {
  const [group, setGroup] = useState<Group>("team");
  const [missingOnly, setMissingOnly] = useState(false);
  const owned = new Map(entries.map((e) => [cardKey(e.card), e]));
  const visible = all.filter((c) => !missingOnly || !owned.has(cardKey(c)));
  const sections = new Map<string, GameCard[]>();
  for (const c of visible) {
    const k = sectionOf(c, group);
    sections.set(k, [...(sections.get(k) ?? []), c]);
  }
  const totalIn = (key: string) => all.filter((c) => sectionOf(c, group) === key);

  return (
    <div className="album stack">
      <div className="album-head">
        <div className="segmented" role="group" aria-label="Ranger par">
          {GROUPS.map(([g, label]) => (
            <button key={g} type="button" aria-pressed={group === g} className={group === g ? "is-on" : undefined} onClick={() => setGroup(g)}>
              {label}
            </button>
          ))}
        </div>
        <label className="album-toggle">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> Manquantes
        </label>
      </div>

      {sectionOrder(group, [...sections.keys()]).map((key) => {
        const cards = [...(sections.get(key) ?? [])].sort(
          (a, b) => Number(owned.has(cardKey(b))) - Number(owned.has(cardKey(a))) || b.rating - a.rating,
        );
        const total = totalIn(key);
        const got = total.filter((c) => owned.has(cardKey(c))).length;
        const keys = cards.filter((c) => owned.has(cardKey(c))).map(cardKey);
        return (
          <section key={key} className="album-section" aria-label={sectionTitle(key, group)}>
            <h2 className="album-title">
              {sectionTitle(key, group)}{" "}
              <span className={`album-count${got === total.length ? " is-complete" : ""}`}>
                {got} / {total.length}
                {got === total.length && " ✓"}
              </span>
            </h2>
            <ul className="album-grid" role="list">
              {cards.map((c) => {
                const e = owned.get(cardKey(c));
                return (
                  <li key={cardKey(c)}>
                    {e ? (
                      <button type="button" className="album-card" onClick={() => onOpen(cardKey(c), keys)} aria-label={`Voir ${shortName(c.firstName, c.lastName)}`}>
                        <span className="mini-card" aria-hidden="true">
                          <PlayerCard card={c} />
                        </span>
                        {e.copies > 1 && <span className="album-copies">×{e.copies}</span>}
                      </button>
                    ) : (
                      <span className="album-missing" aria-label={`Carte manquante : ${shortName(c.firstName, c.lastName)}`}>
                        <span aria-hidden="true">?</span>
                        <small aria-hidden="true">{shortName(c.firstName, c.lastName)}</small>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
