/**
 * VUT : récompenses (boosters gagnés, éclats) et fin de saison. Fonctions pures.
 */

import { type GameCard, cardKey } from "./game";

/** Un booster tous les 3 entraînements passés auxquels on a répondu au sondage. */
export const TRAININGS_PER_BOOSTER = 3;
/** Éclats nécessaires pour choisir une carte : commune 5, rare 20. */
export const SHARDS_PER_CARD = 5;
export const SHARDS_PER_RARE = 20;
/** Durée d'affichage du podium de fin de saison sur l'accueil (jours). */
export const PODIUM_DAYS = 7;
/** Nombre de joueurs récompensés chaque semaine. */
export const TOP_REWARDED = 3;

/**
 * Raisons des boosters gagnés : chacune ne rapporte qu'une fois (index unique en base).
 * - `week:AAAA-MM-JJ` : équipe validée cette semaine ;
 * - `top3:AAAA-MM-JJ` : top 3 de la semaine ;
 * - `training:N` : N-ième série de 3 entraînements ;
 * - `event:<id>` : présence à un événement.
 */
export const rewardReason = {
  week: (week: string) => `week:${week}`,
  top3: (week: string) => `top3:${week}`,
  training: (n: number) => `training:${n}`,
  event: (id: string) => `event:${id}`,
};

/** Numéros des séries d'entraînements à récompenser (ex. 7 réponses, 1 déjà reçu → [2]). */
export function trainingRewardsDue(answered: number, alreadyAwarded: number): number[] {
  const due = Math.floor(answered / TRAININGS_PER_BOOSTER);
  return Array.from({ length: Math.max(0, due - alreadyAwarded) }, (_, i) => alreadyAwarded + i + 1);
}

/**
 * Éclats d'une ouverture : chaque carte déjà possédée (avant le booster, ou déjà sortie dans ce
 * même booster) rapporte 1 éclat.
 */
export function shardsFromOpening(ownedBefore: Set<string>, cards: GameCard[]): number {
  const seen = new Set(ownedBefore);
  let shards = 0;
  for (const c of cards) {
    const key = cardKey(c);
    if (seen.has(key)) shards++;
    seen.add(key);
  }
  return shards;
}

/** Cartes qu'on peut choisir contre des éclats : communes et rares (pas Capitaine ni Légende). */
export const exchangeable = (c: GameCard) => (c.kind ?? "common") === "common" || c.kind === "rare";

/** Prix d'une carte en éclats (null : pas échangeable). */
export const shardPrice = (c: GameCard): number | null =>
  (c.kind ?? "common") === "common" ? SHARDS_PER_CARD : c.kind === "rare" ? SHARDS_PER_RARE : null;

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);

/** Le podium de la saison s'affiche du lendemain de la fin de saison, pendant 7 jours. */
export function podiumVisible(seasonEnd: string, today: string): boolean {
  const d = days(seasonEnd, today);
  return d >= 1 && d <= PODIUM_DAYS;
}

/** Les semaines VUT d'une saison : lundis compris entre son début et sa fin. */
export const inSeason = (week: string, season: { startsOn: string; endsOn: string }) =>
  week >= weekMonday(season.startsOn) && week <= season.endsOn;

function weekMonday(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
}
