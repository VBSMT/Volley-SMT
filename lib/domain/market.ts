/**
 * VUT : marché entre joueurs (fonctions pures). Une annonce = une carte (pas de Légende) contre des
 * éclats (prix minimum selon la rareté) et/ou une carte précise de même rareté. Une offre = des
 * éclats et/ou soit une carte de même rareté, soit plusieurs cartes moins rares.
 */
import type { CardKind } from "./game";

/** Prix minimum d'une vente en éclats entre joueurs (la banque, elle, vend 5 / 20 / 100). */
export const MIN_SALE: Record<Exclude<CardKind, "legend">, number> = { common: 3, rare: 12, captain: 75 };
/** Échanges conclus par joueur et par semaine (lundi–dimanche). */
export const TRADES_PER_WEEK = 5;
/** Durée de vie d'une annonce et d'une offre (jours). */
export const LISTING_DAYS = 7;
export const OFFER_DAYS = 3;
/** Allers-retours au plus entre acheteur et vendeur (offre, contre-offre, contre-offre). */
export const MAX_ROUNDS = 3;

const RANK: Record<CardKind, number> = { common: 1, rare: 2, captain: 3, legend: 4 };
export type MarketCard = { memberId: string; teamId: string; kind: CardKind };

export const tradable = (kind: CardKind) => kind !== "legend";

/** Conditions d'une annonce : au moins un prix, éclats ≥ minimum, carte demandée de même rareté. */
export function listingErrors(kind: CardKind, askShards: number | null, askCard: MarketCard | null): string[] {
  if (!tradable(kind)) return ["Les Légendes ne s'échangent pas."];
  const errors: string[] = [];
  if (askShards === null && !askCard) errors.push("Indique un prix en éclats ou la carte voulue.");
  if (askShards !== null && askShards < MIN_SALE[kind]) errors.push(`Prix minimum : ✦ ${MIN_SALE[kind]}.`);
  if (askCard && askCard.kind !== kind) errors.push("La carte demandée doit être de même rareté.");
  return errors;
}

/**
 * Offre sur une carte de rareté `kind` : éclats seuls (≥ minimum), ou une carte de même rareté, ou
 * plusieurs cartes moins rares (éclats en plus permis). Jamais de Légende.
 */
export function offerErrors(kind: CardKind, shards: number, cards: MarketCard[]): string[] {
  if (shards < 0 || !Number.isInteger(shards)) return ["Nombre d'éclats invalide."];
  if (cards.some((c) => !tradable(c.kind))) return ["Les Légendes ne s'échangent pas."];
  if (!cards.length) return shards >= MIN_SALE[kind as Exclude<CardKind, "legend">] ? [] : [`Offre minimum : ✦ ${MIN_SALE[kind as Exclude<CardKind, "legend">]}.`];
  const same = cards.filter((c) => RANK[c.kind] === RANK[kind]);
  const less = cards.filter((c) => RANK[c.kind] < RANK[kind]);
  if (cards.some((c) => RANK[c.kind] > RANK[kind])) return ["On ne propose pas une carte plus rare."];
  if (same.length && (same.length > 1 || less.length)) return ["Une seule carte de même rareté, ou plusieurs cartes moins rares."];
  return [];
}
