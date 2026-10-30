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

export type GameCard = {
  memberId: string;
  teamId: string;
  teamName: string;
  firstName: string;
  lastName: string;
  sex: "F" | "M";
  position: GamePosition;
  rating: number;
  bestRating: number;
  /** Version de la photo (null : pas de photo, ou droit à l'image retiré). */
  photoVersion: string | null;
};

export const cardKey = (c: { memberId: string; teamId: string }) => `${c.memberId}:${c.teamId}`;

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
export function drawStarter(pool: GameCard[], rng: Rng = Math.random): GameCard[] {
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

/** Booster gagné : 2 ou 3 cartes (une chance sur deux), totalement au hasard (doublons possibles). */
export function drawEarned(pool: GameCard[], rng: Rng = Math.random): GameCard[] {
  if (!pool.length) return [];
  const size = rng() < 0.5 ? 2 : 3;
  return Array.from({ length: size }, () => pool[Math.floor(rng() * pool.length)]);
}
