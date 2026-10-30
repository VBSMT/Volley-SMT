/**
 * Jeu de cartes du club (style FUT). Fonctions pures : note de forme, tirage des boosters.
 * Une carte = un joueur dans une équipe (poste 1). Les points viennent du résultat de son équipe.
 */

import type { StandingRow } from "./standings";

export type GamePosition = "setter" | "front_right" | "front_left" | "back";
export const GAME_POSITIONS: GamePosition[] = ["setter", "front_left", "front_right", "back"];

export const GAME_POSITION_LABELS: Record<GamePosition, string> = {
  setter: "Passe",
  front_left: "Avant (4)",
  front_right: "Avant (2)",
  back: "Fond",
};

/** Rareté : commune (poste 1), rare (poste 2), ultra rare (capitaine), légende (Bureau). */
export type CardKind = "common" | "rare" | "captain" | "legend";

/** Bonus des Légendes (un par membre du Bureau, table `game_legends`). */
export type LegendBonus = "per_win" | "back_x5" | "setter_x4" | "front_x2_5" | "bench_x2" | "five_girls" | "all_win_30";
export const LEGEND_BONUS_LABELS: Record<LegendBonus, string> = {
  per_win: "+2 par titulaire gagnant",
  back_x5: "×5 bonus du fond",
  setter_x4: "×4 bonus du passeur",
  front_x2_5: "×2,5 bonus des avants",
  bench_x2: "Remplaçant à 100 %",
  five_girls: "+8 si 5 filles",
  all_win_30: "+30 % si les 4 titulaires gagnent",
};

export type GameCard = {
  memberId: string;
  /** Équipe de la carte ("" pour une Légende, carte du Bureau). */
  teamId: string;
  kind?: CardKind;
  teamName: string;
  firstName: string;
  lastName: string;
  sex: "F" | "M";
  position: GamePosition;
  rating: number;
  bestRating: number;
  /** Version de la photo (null : pas de photo, ou droit à l'image retiré ; jamais sur Capitaine/Légende). */
  photoVersion: string | null;
  legendBonus?: LegendBonus | null;
  /** Carte unique du développeur de l'appli (Légende, style « LE DEV »). */
  isDev?: boolean;
};

export const cardKey = (c: { memberId: string; teamId: string; kind?: CardKind }) => `${c.kind ?? "common"}:${c.memberId}:${c.teamId}`;
export const isSpecial = (c: { kind?: CardKind }) => c.kind === "captain" || c.kind === "legend";

/** Chances de tirage, par carte qui sort d'un booster gagné. */
export const LEGEND_RATE = 0.005;
export const CAPTAIN_RATE = 0.03;
export const RARE_RATE = 0.1;

/** L'ancien « avant » sans côté devient Avant (4). */
export function gamePosition(p: string | null): GamePosition | null {
  if (p === "front") return "front_left";
  return (GAME_POSITIONS as string[]).includes(p ?? "") ? (p as GamePosition) : null;
}

// --- Note de forme -----------------------------------------------------------------------------

export const DEFAULT_RATING = 60;
export const FORM_MATCHES = 5;

type Scores = StandingRow["scores"];
const SCORE_POINTS: Record<keyof Scores, number> = { s30: 10, s31: 8, s32: 6, s23: 3, s13: 1, s03: 0, fWon: 10, fLost: 0 };

/** Points du barème de base d'un match selon le score (3-0 → 10 … 0-3 → 0 ; forfait gagné = 3-0). */
export const scorePoints = (key: keyof Scores) => SCORE_POINTS[key];

/** Note de 40 à 99 : moyenne des points des derniers matchs (5 au plus) ; 60 avant le premier match. */
export function formRating(points: number[]): number {
  const recent = points.slice(-FORM_MATCHES);
  if (!recent.length) return DEFAULT_RATING;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.round(40 + avg * 5.9);
}

export type Tier = "gold" | "silver" | "bronze";
export const tierOf = (rating: number): Tier => (rating >= 80 ? "gold" : rating >= 65 ? "silver" : "bronze");

export type FormState = { recent: number[]; lastScores: Scores | null; rating: number; bestRating: number };

/**
 * Nouvel état de forme après une photo du classement : les matchs apparus depuis la photo
 * précédente (compteurs de scores en hausse) s'ajoutent aux derniers matchs. À la première photo,
 * les matchs déjà joués sont repris (ordre inconnu, sans incidence sur la moyenne).
 */
export function nextForm(prev: FormState | null, scores: Scores): FormState {
  const base = prev?.lastScores ?? null;
  const added: number[] = [];
  for (const key of Object.keys(SCORE_POINTS) as (keyof Scores)[]) {
    const diff = (scores[key] ?? 0) - (base?.[key] ?? 0);
    for (let k = 0; k < diff; k++) added.push(SCORE_POINTS[key]);
  }
  const recent = [...(prev?.recent ?? []), ...added].slice(-FORM_MATCHES);
  const rating = formRating(recent);
  return { recent, lastScores: scores, rating, bestRating: Math.max(prev?.bestRating ?? rating, rating) };
}

// --- Boosters ----------------------------------------------------------------------------------

export const STARTER_SIZE = 6;
export const MAX_PER_TEAM = 2;

export type Rng = () => number;

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Le booster de départ respecte-t-il les règles ? */
export function isValidStarter(cards: GameCard[]): boolean {
  const keys = new Set(cards.map(cardKey));
  const members = new Set(cards.map((c) => c.memberId));
  const perTeam = new Map<string, number>();
  for (const c of cards) perTeam.set(c.teamId, (perTeam.get(c.teamId) ?? 0) + 1);
  return (
    cards.length === STARTER_SIZE &&
    keys.size === cards.length &&
    members.size === cards.length &&
    GAME_POSITIONS.every((p) => cards.some((c) => c.position === p)) &&
    cards.some((c) => c.sex === "F") &&
    [...perTeam.values()].every((n) => n <= MAX_PER_TEAM)
  );
}

/**
 * Booster de départ : 6 cartes, au moins une par poste, au moins une fille, pas de doublon
 * (ni deux cartes du même joueur), au plus 2 joueurs d'une même équipe. Tirages aléatoires
 * successifs ; si les cartes du club ne permettent pas toutes les règles, le meilleur tirage
 * possible (les règles assouplies dans l'ordre inverse) est renvoyé.
 */
export function drawStarter(all: GameCard[], rng: Rng = Math.random): GameCard[] {
  // Que des cartes communes dans le booster de départ.
  const pool = all.filter((c) => (c.kind ?? "common") === "common");
  let best: GameCard[] = [];
  let bestScore = -1;
  for (let attempt = 0; attempt < 300; attempt++) {
    const picked: GameCard[] = [];
    const perTeam = new Map<string, number>();
    const usedMembers = new Set<string>();
    const fits = (c: GameCard, teamLimit: boolean) =>
      !usedMembers.has(c.memberId) && (!teamLimit || (perTeam.get(c.teamId) ?? 0) < MAX_PER_TEAM);
    const take = (c: GameCard) => {
      picked.push(c);
      usedMembers.add(c.memberId);
      perTeam.set(c.teamId, (perTeam.get(c.teamId) ?? 0) + 1);
    };
    const order = shuffle(pool, rng);
    // Une fille d'abord, puis un joueur par poste manquant, puis le reste au hasard.
    const girl = order.find((c) => c.sex === "F");
    if (girl) take(girl);
    for (const p of shuffle(GAME_POSITIONS, rng)) {
      if (picked.some((c) => c.position === p)) continue;
      const c = order.find((x) => x.position === p && fits(x, true));
      if (c) take(c);
    }
    for (const teamLimit of [true, false]) {
      for (const c of order) {
        if (picked.length >= STARTER_SIZE) break;
        if (fits(c, teamLimit)) take(c);
      }
    }
    if (isValidStarter(picked)) return shuffle(picked, rng);
    const score =
      picked.length * 10 +
      GAME_POSITIONS.filter((p) => picked.some((c) => c.position === p)).length * 3 +
      (picked.some((c) => c.sex === "F") ? 2 : 0);
    if (score > bestScore) [best, bestScore] = [picked, score];
  }
  return shuffle(best, rng);
}

/**
 * Booster gagné : 2 ou 3 cartes (une chance sur deux), totalement au hasard (doublons possibles).
 * Pour chaque carte : 0,5 % Légende, sinon 3 % Capitaine, sinon un joueur au hasard (commune),
 * remplacée par sa version rare (2ᵉ poste) dans 10 % des cas s'il en a une.
 */
export function drawEarned(pool: GameCard[], rng: Rng = Math.random): GameCard[] {
  const commons = pool.filter((c) => (c.kind ?? "common") === "common");
  const captains = pool.filter((c) => c.kind === "captain");
  const legends = pool.filter((c) => c.kind === "legend");
  const rares = new Map(pool.filter((c) => c.kind === "rare").map((c) => [`${c.memberId}:${c.teamId}`, c]));
  if (!commons.length && !captains.length && !legends.length) return [];
  const pick = <T,>(list: T[]) => list[Math.floor(rng() * list.length)];
  const size = rng() < 0.5 ? 2 : 3;
  return Array.from({ length: size }, () => {
    const r = rng();
    if (legends.length && r < LEGEND_RATE) return pick(legends);
    if (captains.length && r < LEGEND_RATE + CAPTAIN_RATE) return pick(captains);
    const card = pick(commons.length ? commons : captains.length ? captains : legends);
    const rare = rares.get(`${card.memberId}:${card.teamId}`);
    return rare && rng() < RARE_RATE ? rare : card;
  });
}
