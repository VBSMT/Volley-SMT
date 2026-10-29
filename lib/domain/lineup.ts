/**
 * Composition des équipes du soir (CLAUDE.md, « Algorithme de composition »). Fonctions pures.
 */

export type Sex = "F" | "M";
export type Position = "setter" | "front" | "back";

export type LineupPlayer = {
  id: string;
  sex: Sex;
  level: number | null; // null = niveau non renseigné (compté au niveau par défaut)
  position1: Position | null;
  position2: Position | null;
};

export type TeamPlan = {
  n: number; // nombre d'équipes
  sizes: number[]; // taille de chaque équipe (écart max 1)
  rotation: boolean; // n impair : une équipe au repos à tour de rôle
  overflow: boolean; // plus de joueurs que 6 × (2T + 1)
  tooFew: boolean; // moins de 8 présents
};

/** Étape 1 : nombre d'équipes n et tailles, pour P présents et T terrains libres. */
export function planTeams(present: number, courts: number): TeamPlan {
  const sizesFor = (n: number) =>
    Array.from({ length: n }, (_, i) => Math.floor(present / n) + (i < present % n ? 1 : 0));
  const plan = (n: number, flags: Partial<TeamPlan> = {}): TeamPlan => ({
    n,
    sizes: n > 0 ? sizesFor(n) : [],
    rotation: n % 2 === 1,
    overflow: false,
    tooFew: false,
    ...flags,
  });

  if (present <= 0 || courts <= 0) return plan(0);
  if (present < 8) return plan(2, { tooFew: true });
  if (present > 6 * (2 * courts + 1)) return plan(2 * courts + 1, { overflow: true });
  for (let t = courts; t >= 1; t--) {
    if (4 * (2 * t + 1) <= present && present <= 6 * (2 * t + 1)) return plan(2 * t + 1);
    if (8 * t <= present && present <= 12 * t) return plan(2 * t);
  }
  // Inatteignable pour P ≥ 8 et T ≥ 1 (les intervalles couvrent tout) : repli prudent.
  return plan(2);
}

// --- Étape 2 : répartition --------------------------------------------------

export const DEFAULT_LEVEL = 3;

/** Poids décroissants des contraintes, de la plus forte à la plus faible. */
const WEIGHTS = { level: 10_000, girls: 1_000, setter: 100, position1: 10, back: 1 };

const levelOf = (p: LineupPlayer) => p.level ?? DEFAULT_LEVEL;
const plays = (p: LineupPlayer, pos: Position) => p.position1 === pos || p.position2 === pos;

type Breakdown = {
  levelSpread: number; // écart entre la plus forte et la plus faible somme de niveaux
  girlIssues: number;
  noSetter: number;
  notPosition1: number; // équipes dont le passeur ou le joueur de fond n'est qu'en poste 2
  noBack: number;
};

function breakdown(teams: LineupPlayer[][], girlsTotal: number): Breakdown {
  const sums = teams.map((t) => t.reduce((s, p) => s + levelOf(p), 0));
  const b: Breakdown = {
    levelSpread: Math.max(...sums) - Math.min(...sums),
    girlIssues: 0,
    noSetter: 0,
    notPosition1: 0,
    noBack: 0,
  };
  for (const team of teams) {
    const girls = team.filter((p) => p.sex === "F").length;
    // ≥ 1 fille par équipe ; s'il y a moins de filles que d'équipes, au plus 1 par équipe.
    if (girlsTotal >= teams.length ? girls === 0 : girls > 1) b.girlIssues += girlsTotal >= teams.length ? 1 : girls - 1;

    if (!team.some((p) => plays(p, "setter"))) b.noSetter++;
    else if (!team.some((p) => p.position1 === "setter")) b.notPosition1++;

    if (!team.some((p) => plays(p, "back"))) b.noBack++;
    else if (!team.some((p) => p.position1 === "back")) b.notPosition1++;
  }
  return b;
}

const cost = (b: Breakdown) =>
  b.levelSpread * WEIGHTS.level +
  b.girlIssues * WEIGHTS.girls +
  b.noSetter * WEIGHTS.setter +
  b.notPosition1 * WEIGHTS.position1 +
  b.noBack * WEIGHTS.back;

export type Lineup = {
  plan: TeamPlan;
  teams: { players: string[]; levelSum: number; girls: number }[];
  warnings: string[];
};

/**
 * Étape 2 : répartition en serpent par niveau décroissant, puis échanges entre équipes
 * tant qu'un échange réduit le coût pondéré. Les contraintes non tenues sont remontées.
 */
export function buildLineup(players: LineupPlayer[], courts: number): Lineup {
  const plan = planTeams(players.length, courts);
  if (plan.n === 0) {
    return { plan, teams: [], warnings: [courts <= 0 ? "Aucun terrain libre ce soir." : "Aucun présent."] };
  }

  // Serpent : ordre déterministe (niveau décroissant, puis identifiant).
  const sorted = [...players].sort((a, b) => levelOf(b) - levelOf(a) || a.id.localeCompare(b.id));
  const teams: LineupPlayer[][] = plan.sizes.map(() => []);
  let i = 0;
  let dir = 1;
  for (const p of sorted) {
    while (teams[i].length >= plan.sizes[i]) {
      i += dir;
      if (i === plan.n || i < 0) {
        dir = -dir;
        i += dir;
      }
    }
    teams[i].push(p);
    i += dir;
    if (i === plan.n || i < 0) {
      dir = -dir;
      i += dir;
    }
  }

  // Échanges : à chaque tour, le meilleur échange améliorant ; arrêt quand plus aucun n'améliore.
  const girlsTotal = players.filter((p) => p.sex === "F").length;
  let current = cost(breakdown(teams, girlsTotal));
  for (let guard = 0; guard < 500; guard++) {
    let best: { a: number; ai: number; b: number; bi: number; cost: number } | null = null;
    for (let a = 0; a < plan.n; a++) {
      for (let b = a + 1; b < plan.n; b++) {
        for (let ai = 0; ai < teams[a].length; ai++) {
          for (let bi = 0; bi < teams[b].length; bi++) {
            [teams[a][ai], teams[b][bi]] = [teams[b][bi], teams[a][ai]];
            const c = cost(breakdown(teams, girlsTotal));
            [teams[a][ai], teams[b][bi]] = [teams[b][bi], teams[a][ai]];
            if (c < (best?.cost ?? current)) best = { a, ai, b, bi, cost: c };
          }
        }
      }
    }
    if (!best) break;
    [teams[best.a][best.ai], teams[best.b][best.bi]] = [teams[best.b][best.bi], teams[best.a][best.ai]];
    current = best.cost;
  }

  return { plan, ...summarize(teams, players.length, plan) };
}

/** Totaux par équipe et contraintes non tenues (remontées au Bureau). */
function summarize(teams: LineupPlayer[][], present: number, plan: Pick<TeamPlan, "n" | "tooFew" | "overflow">) {
  const players = teams.flat();
  const warnings: string[] = [];
  const girlsTotal = players.filter((p) => p.sex === "F").length;
  if (plan.tooFew) warnings.push(`Seulement ${present} présents : 2 équipes incomplètes.`);
  if (plan.overflow) warnings.push(`${present} présents : équipes de plus de 6 (débordement).`);
  const missingLevels = players.filter((p) => p.level === null).length;
  if (missingLevels) {
    warnings.push(`${missingLevels} présent${missingLevels > 1 ? "s" : ""} sans niveau (compté${missingLevels > 1 ? "s" : ""} ${DEFAULT_LEVEL}).`);
  }
  const b = breakdown(teams, girlsTotal);
  if (b.levelSpread > 1) warnings.push(`Écart de niveau de ${b.levelSpread} entre la plus forte et la plus faible équipe.`);
  teams.forEach((team, k) => {
    const label = `Équipe ${k + 1}`;
    if (!team.length) return warnings.push(`${label} vide.`);
    const girls = team.filter((p) => p.sex === "F").length;
    if (girlsTotal >= plan.n && girls === 0) warnings.push(`${label} sans fille.`);
    if (girlsTotal < plan.n && girls > 1) warnings.push(`${label} : ${girls} filles (moins de filles que d'équipes).`);
    if (!team.some((p) => plays(p, "setter"))) warnings.push(`${label} sans passeur.`);
    if (!team.some((p) => plays(p, "back"))) warnings.push(`${label} sans joueur de fond.`);
  });
  return {
    teams: teams.map((team) => ({
      players: team.map((p) => p.id),
      levelSum: team.reduce((s, p) => s + levelOf(p), 0),
      girls: team.filter((p) => p.sex === "F").length,
    })),
    warnings,
  };
}

/**
 * Compo modifiée à la main par le Bureau (glisser-déposer) : mêmes totaux et alertes,
 * sans recalcul de la répartition.
 */
export function manualLineup(teams: LineupPlayer[][]): Omit<Lineup, "plan"> {
  const present = teams.flat().length;
  return summarize(teams, present, { n: teams.length, tooFew: present < 8, overflow: teams.some((t) => t.length > 6) });
}
