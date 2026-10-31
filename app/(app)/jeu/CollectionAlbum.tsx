"use client";

import { useState } from "react";
import { PlayerCard } from "@/components/game/PlayerCard";
import { type GameCard, type GamePosition, GAME_POSITIONS, GAME_POSITION_LABELS, cardKey } from "@/lib/domain/game";
import { shardPrice } from "@/lib/domain/game-rewards";
import { shortName } from "@/lib/format";

type Entry = { card: GameCard; copies: number; gifted?: boolean };
type Group = "team" | "position" | "kind";

const GROUPS: [Group, string][] = [
  ["team", "Équipe"],
  ["position", "Poste"],
  ["kind", "Rareté"],
];
// Les plus rares en premier.
const KINDS = [
  ["legend", "♛ Légendes"],
  ["captain", "C Capitaines"],
  ["rare", "★ Rares"],
  ["common", "Communes"],
] as const;

/** Carte manquante : symbole et précision de rareté (une rare = 2ᵉ poste d'un joueur déjà possédé). */
const MISSING_MARK = { common: "?", rare: "★", captain: "C", legend: "♛" } as const;
const MISSING_KIND = { common: "", rare: " (rare, 2ᵉ poste)", captain: " (Capitaine)", legend: " (Légende)" } as const;

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
export function CollectionAlbum({
  entries,
  all,
  onOpen,
  exchange,
}: {
  entries: Entry[];
  all: GameCard[];
  onOpen: (key: string, keys: string[]) => void;
  /** Mode échange : cartes manquantes seulement, avec leur prix en éclats ; toucher = acheter. */
  exchange?: { shards: number; onBuy: (card: GameCard) => void };
}) {
  const [group, setGroup] = useState<Group>("team");
  // Par défaut, seulement les cartes possédées ; « Manquantes » ajoute les cartes manquantes.
  const [showMissing, setShowMissing] = useState(false);
  const owned = new Map(entries.map((e) => [cardKey(e.card), e]));
  // Mode échange : seulement les cartes manquantes échangeables.
  const visible = all.filter((c) =>
    exchange ? !owned.has(cardKey(c)) && shardPrice(c) !== null : showMissing || owned.has(cardKey(c)),
  );
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
        {!exchange && (
          <label className="album-toggle">
            <input type="checkbox" checked={showMissing} onChange={(e) => setShowMissing(e.target.checked)} /> Manquantes
          </label>
        )}
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
                      </button>
                    ) : exchange ? (
                      <button
                        type="button"
                        className={`album-missing album-buy${(shardPrice(c) ?? Infinity) <= exchange.shards ? " is-affordable" : ""}${c.kind === "rare" ? " is-rare" : ""}`}
                        disabled={(shardPrice(c) ?? Infinity) > exchange.shards}
                        onClick={() => exchange.onBuy(c)}
                        aria-label={`Obtenir ${shortName(c.firstName, c.lastName)}${c.kind === "rare" ? " (rare)" : ""} pour ${shardPrice(c)} éclats`}
                      >
                        <span aria-hidden="true">{c.kind === "rare" ? "★" : "?"}</span>
                        <small aria-hidden="true">{shortName(c.firstName, c.lastName)}</small>
                        <b className="album-price" aria-hidden="true">✦ {shardPrice(c)}</b>
                      </button>
                    ) : (
                      <span
                        className={`album-missing${c.kind === "rare" ? " is-rare" : ""}`}
                        aria-label={`Carte manquante : ${shortName(c.firstName, c.lastName)}${MISSING_KIND[c.kind ?? "common"]}`}
                      >
                        <span aria-hidden="true">{MISSING_MARK[c.kind ?? "common"]}</span>
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
