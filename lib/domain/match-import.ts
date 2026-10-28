import { parisWallTimeToUtc } from "./paris-time";

/** Match lu dans le fichier Excel du club (une ligne = un match d'une équipe SMDT). */
export type ImportedMatch = {
  teamName: string; // sans le préfixe « SMDT/ »
  competition: string; // ex. « 4x4 Mixte »
  division: string | null; // ex. « Niveau 2 - Poule : 1 »
  phase: string; // « Aller » / « Retour »
  round: number; // journée
  isHome: boolean;
  opponent: string;
  venue: string | null;
  city: string | null;
  startsAt: string; // ISO UTC
};

export type MatchImportResult = { matches: ImportedMatch[]; errors: string[] };

const COLUMNS = {
  date: "date",
  time: "heure",
  competition: "championnat",
  division: "niveau / poule",
  phase: "phase",
  round: "journee",
  team: "equipe smdt",
  homeAway: "dom./ext.",
  opponent: "adversaire",
  venue: "salle",
  city: "ville",
} as const;
const REQUIRED: (keyof typeof COLUMNS)[] = ["date", "time", "competition", "phase", "round", "team", "homeAway", "opponent"];

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const text = (value: unknown) => {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};

/** Les dates/heures Excel arrivent comme des Date dont les composantes UTC sont l'heure murale. */
function wallClock(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return null;
}

function parseTime(value: unknown): [number, number] | null {
  const d = wallClock(value);
  if (d) return [d.getUTCHours(), d.getUTCMinutes()];
  const m = /^(\d{1,2})[h:](\d{2})?$/i.exec(String(value ?? "").trim());
  return m ? [Number(m[1]), Number(m[2] ?? 0)] : null;
}

/**
 * Transforme les lignes de la feuille (première ligne = en-têtes) en matchs.
 * Les colonnes sont repérées par leur titre, pas par leur position.
 */
export function parseMatchSheet(rows: unknown[][]): MatchImportResult {
  const errors: string[] = [];
  const header = (rows[0] ?? []).map(normalize);
  const index = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, title]) => [key, header.indexOf(title)]),
  ) as Record<keyof typeof COLUMNS, number>;

  const missing = REQUIRED.filter((key) => index[key] < 0);
  if (missing.length) {
    return {
      matches: [],
      errors: [`Colonnes introuvables : ${missing.map((k) => `« ${COLUMNS[k]} »`).join(", ")}.`],
    };
  }

  const matches: ImportedMatch[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const cell = (key: keyof typeof COLUMNS) => (index[key] >= 0 ? row[index[key]] : null);
    if (row.every((c) => c === null || c === undefined || c === "")) return;

    const date = wallClock(cell("date"));
    const time = parseTime(cell("time"));
    const team = text(cell("team"))?.replace(/^SMDT\s*\/\s*/i, "");
    const competition = text(cell("competition"));
    const opponent = text(cell("opponent"));
    const phase = text(cell("phase"));
    const round = Number(cell("round"));
    const homeAway = normalize(cell("homeAway"));

    const problems = [
      !date && "date invalide",
      !time && "heure invalide",
      !team && "équipe manquante",
      !competition && "championnat manquant",
      !phase && "phase manquante",
      !opponent && "adversaire manquant",
      !(Number.isInteger(round) && round > 0) && "journée invalide",
      !["domicile", "exterieur"].includes(homeAway) && "Dom./Ext. invalide",
    ].filter(Boolean);
    if (problems.length) {
      errors.push(`Ligne ${line} : ${problems.join(", ")}.`);
      return;
    }

    const key = `${team}|${competition}|${phase}|${round}`;
    if (seen.has(key)) {
      errors.push(`Ligne ${line} : journée ${round} (${phase}) de « ${team} » en double.`);
      return;
    }
    seen.add(key);

    const startsAt = parisWallTimeToUtc(
      date!.getUTCFullYear(),
      date!.getUTCMonth() + 1,
      date!.getUTCDate(),
      time![0],
      time![1],
    );

    matches.push({
      teamName: team!,
      competition: competition!,
      division: text(cell("division")),
      phase: phase!,
      round,
      isHome: homeAway === "domicile",
      opponent: opponent!,
      venue: text(cell("venue")),
      city: text(cell("city")),
      startsAt: startsAt.toISOString(),
    });
  });

  if (!matches.length && !errors.length) errors.push("Aucun match trouvé dans le fichier.");
  return { matches, errors };
}
