/**
 * Classements volley34 (accord de la commission). Fonctions pures.
 * Champs repris du site volley34 (Classements.js) : Rang, Nom, Joue, Gagne, Perdu, Forfait,
 * Total, SefDiff (sic), PointDiff, Division, Poule, ClassementCode, CodeCompetition, NomCompetition.
 * Le format exact de l'API n'a pas encore été observé avec des données : lecture tolérante.
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
};

const ALIASES: Record<keyof Omit<StandingRow, "group">, string[]> = {
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
  competition: ["nomcompetition", "codecompetition"],
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
  // XML : chaque élément qui contient des sous-éléments simples est un enregistrement.
  return [...text.matchAll(/<(\w+)>((?:\s*<\w+(?:\s[^>]*)?(?:\/>|>[^<]*<\/\w+>))+)\s*<\/\1>/g)].map((m) =>
    Object.fromEntries(
      [...m[2].matchAll(/<(\w+)(?:\s[^>]*)?(?:\/>|>([^<]*)<\/\1>)/g)].map((f) => [f[1].toLowerCase(), decode(f[2] ?? "")]),
    ),
  );
}

const pick = (o: Record<string, string>, key: keyof typeof ALIASES) => {
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

/** Zones du site volley34 : podium en niveau 1, sinon 2 premiers montent ; 2 derniers descendent. */
export function zoneOf(rank: number, poolSize: number, division: string | null): Zone {
  const top = division === "1" || division === "EX";
  if (poolSize >= 4 && rank >= poolSize - 1) return "relegation";
  if (top) return rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
  return rank <= 2 ? "promotion" : null;
}

/** « Niveau 2 - Poule 1 » à partir des codes de division et de poule. */
export function poolTitle(division: string | null, pool: string | null): string {
  const levels: Record<string, string> = { EX: "1", HO: "2", PR: "3", AC: "4", PP: "5" };
  const level = division ? `Niveau ${levels[division] ?? division}` : "";
  const poule = pool && pool !== "0" ? `Poule ${pool}` : "";
  return [level, poule].filter(Boolean).join(" - ");
}
