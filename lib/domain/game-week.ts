/**
 * VUT : équipe de la journée (semaine du lundi au dimanche), points et classements. Fonctions pures.
 */

import { type GameCard, type GamePosition, MAX_PER_TEAM, cardKey, scorePoints } from "./game";
import type { StandingRow } from "./standings";

export type Slot = GamePosition | "sub";
export const SLOTS: Slot[] = ["setter", "front_left", "front_right", "back", "sub"];
export const STARTERS: GamePosition[] = ["setter", "front_left", "front_right", "back"];
export const SUB_FACTOR = 0.5;

const DAY = 86_400_000;

/** Lundi (date AAAA-MM-JJ) de la semaine d'une date AAAA-MM-JJ. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // lundi = 0
  return new Date(d.getTime() - shift * DAY).toISOString().slice(0, 10);
}

export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export type Lineup = Partial<Record<Slot, { memberId: string; teamId: string }>>;

/**
 * Règles de l'équipe : 4 titulaires à leur poste, un remplaçant (facultatif) de n'importe quel
 * poste, au moins une fille parmi les titulaires, au plus 2 joueurs d'une même équipe, pas deux
 * fois le même joueur, uniquement des cartes de sa collection. Renvoie les erreurs (vide = valide).
 */
export function lineupErrors(lineup: Lineup, owned: GameCard[]): string[] {
  const byKey = new Map(owned.map((c) => [cardKey(c), c]));
  const errors: string[] = [];
  const cards: GameCard[] = [];
  for (const slot of SLOTS) {
    const pick = lineup[slot];
    if (!pick) {
      if (slot !== "sub") errors.push("Il faut un joueur à chaque poste.");
      continue;
    }
    const card = byKey.get(cardKey(pick));
    if (!card) {
      errors.push("Carte absente de ta collection.");
      continue;
    }
    if (slot !== "sub" && card.position !== slot) errors.push("Un joueur n'est pas à son poste.");
    cards.push(card);
  }
  const starters = STARTERS.map((s) => lineup[s] && byKey.get(cardKey(lineup[s]!))).filter(Boolean) as GameCard[];
  if (starters.length === 4 && !starters.some((c) => c.sex === "F")) errors.push("Il faut au moins une fille parmi les titulaires.");
  if (new Set(cards.map((c) => c.memberId)).size < cards.length) errors.push("Un même joueur ne peut être aligné qu'une fois.");
  const perTeam = new Map<string, number>();
  for (const c of cards) perTeam.set(c.teamId, (perTeam.get(c.teamId) ?? 0) + 1);
  if ([...perTeam.values()].some((n) => n > MAX_PER_TEAM)) errors.push(`Au plus ${MAX_PER_TEAM} joueurs d'une même équipe.`);
  return [...new Set(errors)];
}

// --- Résultats d'une équipe sur la semaine (photos du classement) -----------------------------

export type TeamWeek = {
  /** Scores des matchs de la semaine (clés de répartition : s30, s31… fWon, fLost). */
  scores: (keyof StandingRow["scores"])[];
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
};

type Totals = Pick<StandingRow, "scores" | "setsWon" | "setsLost" | "pointsWon" | "pointsLost">;

/** Matchs joués entre deux photos du classement (avant = dernière photo du lundi de la semaine). */
export function teamWeek(before: Totals | null, after: Totals | null): TeamWeek | null {
  if (!after) return null;
  const scores: TeamWeek["scores"] = [];
  for (const key of Object.keys(after.scores) as (keyof Totals["scores"])[]) {
    const n = after.scores[key] - (before?.scores[key] ?? 0);
    for (let k = 0; k < n; k++) scores.push(key);
  }
  if (!scores.length) return null;
  return {
    scores,
    setsWon: after.setsWon - (before?.setsWon ?? 0),
    setsLost: after.setsLost - (before?.setsLost ?? 0),
    pointsWon: after.pointsWon - (before?.pointsWon ?? 0),
    pointsLost: after.pointsLost - (before?.pointsLost ?? 0),
  };
}

const SETS: Record<string, [number, number]> = { s30: [3, 0], s31: [3, 1], s32: [3, 2], s23: [2, 3], s13: [1, 3], s03: [0, 3], fWon: [3, 0], fLost: [0, 3] };

/** Semaine simulée (outils de test) : scores seuls, sans les points par set (règles de repli). */
export function simulatedWeek(scores: TeamWeek["scores"]): TeamWeek | null {
  if (!scores.length) return null;
  return {
    scores,
    setsWon: scores.reduce((a, k) => a + SETS[k][0], 0),
    setsLost: scores.reduce((a, k) => a + SETS[k][1], 0),
    pointsWon: 0,
    pointsLost: 0,
  };
}

// --- Points ------------------------------------------------------------------------------------

export type CardScore = { base: number; bonus: number };

/**
 * Points d'une carte pour la semaine : barème du score de chaque match + bonus du poste.
 * - passe : +1 par set gagné ;
 * - avant : +1 par tranche de 10 points d'écart (points connus) ; sinon +2 par victoire 3-0 ou 3-1 ;
 * - fond : +2 si l'équipe encaisse 20 points ou moins par set en moyenne ; sinon +2 par défaite 2-3.
 * Les points par set viennent des totaux du classement ; sans eux (0), la règle de repli s'applique.
 */
export function cardScore(position: GamePosition, week: TeamWeek): CardScore {
  const base = week.scores.reduce((a, k) => a + scorePoints(k), 0);
  const sets = week.setsWon + week.setsLost;
  const havePoints = week.pointsWon + week.pointsLost > 0;
  let bonus = 0;
  if (position === "setter") bonus = week.setsWon;
  else if (position === "front_left" || position === "front_right") {
    bonus = havePoints ? Math.floor(Math.max(0, week.pointsWon - week.pointsLost) / 10) : 2 * week.scores.filter((k) => k === "s30" || k === "s31").length;
  } else {
    bonus = havePoints ? (sets > 0 && week.pointsLost / sets <= 20 ? 2 : 0) : 2 * week.scores.filter((k) => k === "s23").length;
  }
  return { base, bonus };
}

export type SlotScore = { slot: Slot; memberId: string; teamId: string; played: boolean; factor: number; base: number; bonus: number; total: number };

/**
 * Points de l'équipe de la journée. Le remplaçant compte à 50 % ; si un titulaire n'a pas joué
 * (son équipe sans match), le remplaçant prend sa place et compte à 100 % (une seule fois),
 * au barème de son propre poste.
 */
export function lineupScore(
  lineup: Lineup,
  positions: Map<string, GamePosition>,
  weeks: Map<string, TeamWeek | null>,
): { total: number; bonus: number; slots: SlotScore[] } {
  const score = (slot: Slot, factor: number): SlotScore | null => {
    const pick = lineup[slot];
    if (!pick) return null;
    const week = weeks.get(pick.teamId) ?? null;
    const position = positions.get(cardKey(pick));
    const s = week && position ? cardScore(position, week) : { base: 0, bonus: 0 };
    return { slot, ...pick, played: !!week, factor, base: s.base, bonus: s.bonus, total: (s.base + s.bonus) * factor };
  };
  const slots = STARTERS.map((s) => score(s, 1)).filter((s): s is SlotScore => !!s);
  const absent = slots.some((s) => !s.played);
  const sub = score("sub", absent ? 1 : SUB_FACTOR);
  if (sub) slots.push(sub);
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    total: round(slots.reduce((a, s) => a + s.total, 0)),
    bonus: round(slots.reduce((a, s) => a + s.bonus * s.factor, 0)),
    slots,
  };
}

// --- Verrouillage et classements ---------------------------------------------------------------

/** Une carte est verrouillée dès le début du premier match de son équipe dans la semaine. */
export function isLocked(teamId: string, matches: { teamId: string; startsAt: string }[], now: Date): boolean {
  return matches.some((m) => m.teamId === teamId && Date.parse(m.startsAt) <= now.getTime());
}

export type RankEntry = { ownerId: string; total: number; bonus: number; validatedAt: string };

/** Classement : points, puis bonus de poste, puis équipe validée le plus tôt. */
export function rank<T extends RankEntry>(entries: T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => b.total - a.total || b.bonus - a.bonus || a.validatedAt.localeCompare(b.validatedAt));
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}
