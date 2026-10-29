/**
 * Classements volley34 (accord de la commission). Fonctions pures.
 * Format de l'API (/v1/equipes/{code}/classements, observé en novembre 2026) : un <Classement> par
 * poule (Promus, Relegue, Libelle) contenant des <ClassementCompetition> : Rang, Nom, Joue, Gagne,
 * Perdu, Forfait, Total, SetP/SetC, SefDiff (sic), PointsP/PointsC, PointDiff, NbSets_30…NbSets_03,
 * NbSets_3F/F3. Le JSON du site (Classements.asmx) est aussi accepté.
 */

export type StandingRow = {
  rank: number;
  name: string;
  code: string | null;
  played: number;
  won: number;
  lost: number;
  forfeits: number;
  points: number;
  setDiff: number;
  pointDiff: number;
  division: string | null;
  pool: string | null;
  group: string; // identifiant du classement (une poule)
  competition: string | null;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  /** Matchs par score : victoires 3-0, 3-1, 3-2 ; défaites 2-3, 1-3, 0-3 ; forfaits gagnés/perdus. */
  scores: { s30: number; s31: number; s32: number; s23: number; s13: number; s03: number; fWon: number; fLost: number };
  /** Nombre de montées et de descentes de la poule (null si non fourni). */
  promoted: number | null;
  relegated: number | null;
};

type Field = Exclude<keyof StandingRow, "group" | "scores" | "promoted" | "relegated">;
const ALIASES: Record<Field, string[]> = {
  rank: ["rang", "rank", "position"],
  name: ["nom", "nomequipe", "equipe", "name"],
  code: ["equipecode", "codeequipe", "code"],
  played: ["joue", "joues", "played"],
  won: ["gagne", "gagnes", "won"],
  lost: ["perdu", "perdus", "lost"],
  forfeits: ["forfait", "forfaits"],
  points: ["total", "points", "pts"],
  setDiff: ["sefdiff", "setdiff", "diffsets", "differencesets"],
  pointDiff: ["pointdiff", "diffpoints", "differencepoints"],
  division: ["division"],
  pool: ["poule", "pool"],
  competition: ["nomcompetition", "libelle", "codecompetition"],
  setsWon: ["setp", "setsgagnes"],
  setsLost: ["setc", "setsperdus"],
  pointsWon: ["pointsp"],
  pointsLost: ["pointsc"],
};

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").trim();

/** Objets bruts (clé en minuscules → valeur texte) depuis du XML ou du JSON. */
function rawObjects(body: string): Record<string, string>[] {
  const text = body.trim();
  if (!text) return [];
  if (text.startsWith("[") || text.startsWith("{")) {
    let data = JSON.parse(text) as unknown;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const o = data as Record<string, unknown>;
      data = (o.d as Record<string, unknown> | undefined)?.Classements ?? o.Classements ?? o.classements ?? [o];
    }
    return (data as Record<string, unknown>[]).map((o) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v == null ? "" : String(v)])),
    );
  }
  // XML : en-têtes de poule (montées, descentes), puis chaque élément aux sous-éléments simples.
  const pools = new Map(
    [...text.matchAll(/<ClassementCode>([^<]*)<\/ClassementCode>(?:(?!<classementDetail>)[\s\S])*?<Promus>(\d+)<\/Promus><Relegue>(\d+)<\/Relegue>/g)].map(
      (m) => [m[1], { promus: m[2], relegue: m[3] }],
    ),
  );
  return [...text.matchAll(/<(\w+)>((?:\s*<\w+(?:\s[^>]*)?(?:\/>|>[^<]*<\/\w+>))+)\s*<\/\1>/g)].map((m) =>
    Object.fromEntries(
      [...m[2].matchAll(/<(\w+)(?:\s[^>]*)?(?:\/>|>([^<]*)<\/\1>)/g)].map((f) => [f[1].toLowerCase(), decode(f[2] ?? "")]),
    ),
  ).map((o) => {
    const pool = pools.get(o.classementcode ?? "");
    return pool ? { promus: pool.promus, relegue: pool.relegue, ...o } : o;
  });
}

const pick = (o: Record<string, string>, key: Field) => {
  for (const alias of ALIASES[key]) if (o[alias] !== undefined && o[alias] !== "") return o[alias];
  return null;
};
const num = (v: string | null) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Lignes de classement (toutes poules confondues), triées par poule puis rang. */
export function parseStandings(body: string): StandingRow[] {
  return rawObjects(body)
    .map((o) => {
      const division = pick(o, "division");
      const pool = pick(o, "pool");
      return {
        rank: num(pick(o, "rank")),
        name: pick(o, "name") ?? "",
        code: pick(o, "code"),
        played: num(pick(o, "played")),
        won: num(pick(o, "won")),
        lost: num(pick(o, "lost")),
        forfeits: num(pick(o, "forfeits")),
        points: num(pick(o, "points")),
        setDiff: num(pick(o, "setDiff")),
        pointDiff: num(pick(o, "pointDiff")),
        division,
        pool,
        group: o.classementcode || `${pick(o, "competition") ?? ""}|${division ?? ""}|${pool ?? ""}`,
        competition: pick(o, "competition"),
        setsWon: num(pick(o, "setsWon")),
        setsLost: num(pick(o, "setsLost")),
        pointsWon: num(pick(o, "pointsWon")),
        pointsLost: num(pick(o, "pointsLost")),
        scores: {
          s30: num(o.nbsets_30 ?? null),
          s31: num(o.nbsets_31 ?? null),
          s32: num(o.nbsets_32 ?? null),
          s23: num(o.nbsets_23 ?? null),
          s13: num(o.nbsets_13 ?? null),
          s03: num(o.nbsets_03 ?? null),
          fWon: num(o.nbsets_3f ?? null),
          fLost: num(o.nbsets_f3 ?? null),
        },
        promoted: o.promus !== undefined ? num(o.promus) : null,
        relegated: o.relegue !== undefined ? num(o.relegue) : null,
      };
    })
    .filter((r) => r.name && r.rank > 0)
    .sort((a, b) => a.group.localeCompare(b.group) || a.rank - b.rank);
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

/** Poule de l'équipe (par code volley34, sinon par nom « SMDT/… »). */
export function poolOf(rows: StandingRow[], team: { code: string | null; fullName: string }): StandingRow[] {
  const mine = rows.find((r) => (team.code && r.code === team.code) || norm(r.name) === norm(team.fullName));
  return mine ? rows.filter((r) => r.group === mine.group).sort((a, b) => a.rank - b.rank) : [];
}

export type Zone = "gold" | "silver" | "bronze" | "promotion" | "relegation" | null;

/**
 * Zones : podium en niveau 1, sinon montée ; descente en bas. Nombres de la poule (Promus, Relegue)
 * quand l'API les fournit, sinon règle du site volley34 (2 et 2).
 */
export function zoneOf(
  rank: number,
  poolSize: number,
  division: string | null,
  counts: { promoted?: number | null; relegated?: number | null } = {},
): Zone {
  const top = division === "1" || division === "EX";
  const down = counts.relegated ?? (poolSize >= 4 ? 2 : 0);
  const up = counts.promoted ?? 2;
  if (down > 0 && rank > poolSize - down) return "relegation";
  if (top) return rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
  return rank <= up ? "promotion" : null;
}

/** Aucune équipe de la poule n'a encore joué : classement provisoire (ordre alphabétique). */
export function seasonNotStarted(rows: StandingRow[]): boolean {
  return rows.every((r) => r.played === 0);
}

export type FormResult = { date: string; result: "V" | "D" };

/**
 * Forme récente déduite des photos quotidiennes du classement (l'API des résultats n'étant pas
 * disponible) : chaque match joué entre deux photos est une victoire ou une défaite.
 */
export function recentForm(snapshots: { takenOn: string; won: number; lost: number }[], last = 5): FormResult[] {
  const form: FormResult[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const wins = snapshots[i].won - snapshots[i - 1].won;
    const losses = snapshots[i].lost - snapshots[i - 1].lost;
    for (let k = 0; k < Math.max(0, losses); k++) form.push({ date: snapshots[i].takenOn, result: "D" });
    for (let k = 0; k < Math.max(0, wins); k++) form.push({ date: snapshots[i].takenOn, result: "V" });
  }
  return form.slice(-last);
}

/** « Niveau 2 - Poule 1 » à partir des codes de division et de poule. */
export function poolTitle(division: string | null, pool: string | null): string {
  const levels: Record<string, string> = { EX: "1", HO: "2", PR: "3", AC: "4", PP: "5" };
  const level = division ? `Niveau ${levels[division] ?? division}` : "";
  const poule = pool && pool !== "0" ? `Poule ${pool}` : "";
  return [level, poule].filter(Boolean).join(" - ");
}

/** Tous les résultats déduits des photos quotidiennes (du plus ancien au plus récent). */
export function allResults(snapshots: { takenOn: string; won: number; lost: number }[]): FormResult[] {
  return recentForm(snapshots, Number.MAX_SAFE_INTEGER);
}

export type Streaks = {
  current: { result: "V" | "D"; count: number } | null;
  bestWin: number; // plus longue série de victoires
  worstLoss: number; // plus longue série de défaites
};

/** Série en cours et records de la saison. */
export function streaks(results: FormResult[]): Streaks {
  let bestWin = 0;
  let worstLoss = 0;
  let run = 0;
  let prev: "V" | "D" | null = null;
  for (const r of results) {
    run = r.result === prev ? run + 1 : 1;
    prev = r.result;
    if (prev === "V") bestWin = Math.max(bestWin, run);
    else worstLoss = Math.max(worstLoss, run);
  }
  return { current: prev ? { result: prev, count: run } : null, bestWin, worstLoss };
}

/** Pourcentages de sets et de points gagnés (null si rien joué). */
export function efficiency(row: Pick<StandingRow, "setsWon" | "setsLost" | "pointsWon" | "pointsLost">) {
  const sets = row.setsWon + row.setsLost;
  const points = row.pointsWon + row.pointsLost;
  return {
    setsPct: sets ? Math.round((row.setsWon / sets) * 100) : null,
    pointsPct: points ? Math.round((row.pointsWon / points) * 100) : null,
  };
}

/** Points marqués et encaissés par set pour chaque équipe de la poule (équipes sans set exclues). */
export function attackDefense(rows: StandingRow[]) {
  return rows.flatMap((r) => {
    const sets = r.setsWon + r.setsLost;
    return sets ? [{ name: r.name, code: r.code, scored: r.pointsWon / sets, conceded: r.pointsLost / sets }] : [];
  });
}

export type Victory = {
  takenOn: string; // photo du classement où la victoire apparaît
  prevTakenOn: string;
  score: "3-0" | "3-1" | "3-2" | "forfait" | null; // null si plusieurs victoires entre deux photos
  streak: number; // victoires de suite à ce jour
  rank: number;
  rankDelta: number; // places gagnées (> 0) ou perdues
};

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Dernière victoire d'une équipe vue dans les photos quotidiennes du classement, si elle date
 * d'au plus 48 h (photo d'aujourd'hui ou d'hier) : sert au message de félicitations éphémère.
 */
export function latestVictory(
  snapshots: { takenOn: string; won: number; lost: number; rank: number; mine: Pick<StandingRow, "scores"> | null }[],
  today: string,
): Victory | null {
  for (let i = snapshots.length - 1; i >= 1; i--) {
    const cur = snapshots[i];
    const prev = snapshots[i - 1];
    if (dayDiff(cur.takenOn, today) > 1) return null;
    if (cur.won <= prev.won) continue;
    let score: Victory["score"] = null;
    if (cur.won - prev.won === 1 && cur.mine && prev.mine) {
      const inc = (["s30", "s31", "s32", "fWon"] as const).filter((k) => cur.mine!.scores[k] > prev.mine!.scores[k]);
      if (inc.length === 1) score = inc[0] === "fWon" ? "forfait" : (`${inc[0][1]}-${inc[0][2]}` as Victory["score"]);
    }
    const s = streaks(allResults(snapshots.slice(0, i + 1)));
    return {
      takenOn: cur.takenOn,
      prevTakenOn: prev.takenOn,
      score,
      streak: s.current?.result === "V" ? s.current.count : 1,
      rank: cur.rank,
      rankDelta: prev.rank - cur.rank,
    };
  }
  return null;
}
