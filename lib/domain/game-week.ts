/**
 * VUT : équipe de la journée (semaine du lundi au dimanche), points et classements. Fonctions pures.
 */

import { type CardKind, type GameCard, type GamePosition, type LegendBonus, MAX_PER_TEAM, cardKey, isSpecial, scorePoints } from "./game";
import type { StandingRow } from "./standings";

export type Slot = GamePosition | "sub" | "bonus";
/** Places : 4 titulaires, le remplaçant, et la case Bonus (Capitaine ou Légende). */
export const SLOTS: Slot[] = ["setter", "front_left", "front_right", "back", "sub", "bonus"];
export const STARTERS: GamePosition[] = ["setter", "front_left", "front_right", "back"];
export const SUB_FACTOR = 0.5;

const DAY = 86_400_000;

/** Lundi (date AAAA-MM-JJ) de la semaine d'une date AAAA-MM-JJ. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // lundi = 0
  return new Date(d.getTime() - shift * DAY).toISOString().slice(0, 10);
}

/** Numéro de la journée VUT : semaines écoulées depuis le début de saison (1 = première semaine). */
export function matchday(week: string, seasonStart: string | null): number {
  if (!seasonStart) return 1;
  return Math.max(1, Math.round((Date.parse(`${week}T12:00:00Z`) - Date.parse(`${weekStart(seasonStart)}T12:00:00Z`)) / (7 * DAY)) + 1);
}

/** « Compo Journée 3 — du 03/11 au 09/11 ». */
export function matchdayTitle(week: string, seasonStart: string | null): string {
  const fr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return `Compo Journée ${matchday(week, seasonStart)} — du ${fr(week)} au ${fr(addDays(week, 6))}`;
}

export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export type CardPick = { memberId: string; teamId: string; kind?: CardKind };
export type Lineup = Partial<Record<Slot, CardPick>>;

/**
 * Règles de l'équipe : 4 titulaires à leur poste, un remplaçant (facultatif) de n'importe quel
 * poste, au moins une fille parmi les titulaires, au plus 2 joueurs d'une même équipe, pas deux
 * fois le même joueur, uniquement des cartes de sa collection. Renvoie les erreurs (vide = valide).
 */
export function lineupErrors(lineup: Lineup, owned: GameCard[]): string[] {
  const byKey = new Map(owned.map((c) => [cardKey(c), c]));
  const errors: string[] = [];
  const cards: GameCard[] = []; // cartes sur le terrain (titulaires + remplaçant)
  for (const slot of SLOTS) {
    const pick = lineup[slot];
    if (!pick) {
      if (slot !== "sub" && slot !== "bonus") errors.push("Il faut un joueur à chaque poste.");
      continue;
    }
    const card = byKey.get(cardKey(pick));
    if (!card) {
      errors.push("Carte absente de ta collection.");
      continue;
    }
    if (slot === "bonus") {
      if (!isSpecial(card)) errors.push("La case Bonus accueille un Capitaine ou une Légende.");
      continue;
    }
    if (isSpecial(card)) errors.push("Capitaines et Légendes vont dans la case Bonus.");
    else if (slot !== "sub" && card.position !== slot) errors.push("Un joueur n'est pas à son poste.");
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
  /** Points encaissés set par set, quand volley34 les publie (sinon calcul sur la moyenne). */
  setsConceded?: number[];
};

/** Bonus des avants plafonné. */
export const FRONT_BONUS_MAX = 4;

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
 * - avant : +1 par tranche de 10 points d'écart, au plus +4 (points connus) ; sinon +2 par victoire 3-0 ou 3-1 ;
 * - fond : +1 par set où l'équipe encaisse moins de 20 points (sans le détail par set : +1 par set
 *   joué si la moyenne encaissée est sous 20) ; sans les points, +2 par défaite 2-3.
 * Les points par set viennent des totaux du classement ; sans eux (0), la règle de repli s'applique.
 */
export function cardScore(position: GamePosition, week: TeamWeek): CardScore {
  const base = week.scores.reduce((a, k) => a + scorePoints(k), 0);
  const sets = week.setsWon + week.setsLost;
  const havePoints = week.pointsWon + week.pointsLost > 0;
  let bonus = 0;
  if (position === "setter") bonus = week.setsWon;
  else if (position === "front_left" || position === "front_right") {
    bonus = havePoints
      ? Math.min(FRONT_BONUS_MAX, Math.floor(Math.max(0, week.pointsWon - week.pointsLost) / 10))
      : 2 * week.scores.filter((k) => k === "s30" || k === "s31").length;
  } else if (week.setsConceded?.length) {
    bonus = week.setsConceded.filter((p) => p < 20).length;
  } else {
    // Points par set inconnus (seuls les totaux du classement) : moyenne encaissée < 20 → +1 par set joué.
    bonus = havePoints ? (sets > 0 && week.pointsLost / sets < 20 ? sets : 0) : 2 * week.scores.filter((k) => k === "s23").length;
  }
  return { base, bonus };
}

export type SlotScore = { slot: Slot; memberId: string; teamId: string; played: boolean; factor: number; base: number; bonus: number; total: number };

/** Ce que le calcul des points doit savoir d'une carte alignée. */
export type CardInfo = { position: GamePosition; sex: "F" | "M"; kind: CardKind; legendBonus?: LegendBonus | null };

const WINS = new Set(["s30", "s31", "s32", "fWon"]);
const won = (week: TeamWeek | null | undefined) => !!week?.scores.some((k) => WINS.has(k));

/**
 * Points de l'équipe de la journée. Le remplaçant compte à 50 % ; si un titulaire n'a pas joué
 * (son équipe sans match), le remplaçant prend sa place et compte à 100 % (une seule fois),
 * au barème de son propre poste. Case Bonus :
 * - Capitaine : +5 % du total, +10 % si son équipe gagne son match ;
 * - Légende : son bonus (multiplicateur d'un bonus de poste, remplaçant à 100 %, +2 par titulaire
 *   gagnant, +8 si 5 filles, +30 % du total des titulaires si les 4 gagnent).
 */
export function lineupScore(
  lineup: Lineup,
  cards: Map<string, CardInfo>,
  weeks: Map<string, TeamWeek | null>,
): { total: number; bonus: number; extra: number; slots: SlotScore[] } {
  const special = lineup.bonus ? cards.get(cardKey(lineup.bonus)) : undefined;
  const legend = special?.kind === "legend" ? special.legendBonus : null;
  const multiplier = (position: GamePosition, slot: Slot) => {
    if (slot === "sub") return 1;
    if (legend === "back_x5" && position === "back") return 5;
    if (legend === "setter_x4" && position === "setter") return 4;
    if (legend === "front_x2_5" && (position === "front_left" || position === "front_right")) return 2.5;
    return 1;
  };
  const score = (slot: Slot, factor: number): SlotScore | null => {
    const pick = lineup[slot];
    if (!pick) return null;
    const week = weeks.get(pick.teamId) ?? null;
    const info = cards.get(cardKey(pick));
    const s = week && info ? cardScore(info.position, week) : { base: 0, bonus: 0 };
    const bonus = info ? s.bonus * multiplier(info.position, slot) : 0;
    return { slot, memberId: pick.memberId, teamId: pick.teamId, played: !!week, factor, base: s.base, bonus, total: (s.base + bonus) * factor };
  };
  const starters = STARTERS.map((s) => score(s, 1)).filter((s): s is SlotScore => !!s);
  const absent = starters.some((s) => !s.played);
  // Légende « banc » : le remplaçant compte toujours à 100 % (jamais plus).
  const sub = score("sub", absent || legend === "bench_x2" ? 1 : SUB_FACTOR);
  const slots = sub ? [...starters, sub] : starters;
  const round = (n: number) => Math.round(n * 10) / 10;
  const base = slots.reduce((a, s) => a + s.total, 0);
  const startersTotal = starters.reduce((a, s) => a + s.total, 0);
  const winners = STARTERS.filter((s) => lineup[s] && won(weeks.get(lineup[s]!.teamId))).length;

  let extra = 0;
  if (special?.kind === "captain") extra = base * (won(weeks.get(lineup.bonus!.teamId)) ? 0.1 : 0.05);
  else if (legend === "per_win") extra = 2 * winners;
  else if (legend === "five_girls") {
    const five = ([...STARTERS, "sub"] as Slot[]).map((s) => lineup[s] && cards.get(cardKey(lineup[s]!)));
    extra = five.every((c) => c?.sex === "F") ? 8 : 0;
  } else if (legend === "all_win_30") extra = winners === 4 ? startersTotal * 0.3 : 0;

  return {
    total: round(base + extra),
    bonus: round(slots.reduce((a, s) => a + s.bonus * s.factor, 0) + extra),
    extra: round(extra),
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
