/**
 * Import des adhérents (fichier Excel ou CSV du Bureau). Fonctions pures.
 * Colonnes repérées par leur titre (accents, casse et ordre indifférents).
 */

export type ImportRole = "board" | "volunteer";

export type ImportedMember = {
  line: number;
  email: string;
  lastName: string;
  firstName: string;
  sex: "F" | "M";
  team: string | null;
  captain: boolean;
  roles: ImportRole[];
  phone: string | null;
  license: string | null;
  duesPaid: boolean | null; // null = colonne absente ou vide : on ne touche pas
  level: number | null;
};

const COLUMNS = {
  lastName: ["nom", "nom de famille"],
  firstName: ["prenom"],
  email: ["email", "e-mail", "mail", "adresse email", "adresse mail"],
  sex: ["sexe", "genre"],
  team: ["equipe"],
  captain: ["capitaine"],
  roles: ["roles", "role"],
  phone: ["telephone", "tel", "portable"],
  license: ["licence", "licence fsgt", "numero de licence"],
  duesPaid: ["cotisation", "cotisation reglee", "cotisation payee"],
  level: ["niveau"],
} as const;
type Column = keyof typeof COLUMNS;
const REQUIRED: Column[] = ["lastName", "firstName", "email", "sex"];

export const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const text = (value: unknown) => {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YES = ["oui", "o", "yes", "x", "1", "vrai", "true"];
const NO = ["non", "n", "no", "0", "faux", "false"];

function yesNo(value: unknown): boolean | null | "invalid" {
  const v = normalize(value);
  if (v === "") return null;
  if (YES.includes(v)) return true;
  if (NO.includes(v)) return false;
  return "invalid";
}

function parseSex(value: unknown): "F" | "M" | null {
  const v = normalize(value);
  if (["f", "femme", "feminin", "fille"].includes(v)) return "F";
  if (["m", "h", "homme", "masculin", "garcon"].includes(v)) return "M";
  return null;
}

function parseRoles(value: unknown): ImportRole[] | "invalid" {
  const parts = normalize(value).split(/[,;/+]/).map((p) => p.trim()).filter(Boolean);
  const roles = new Set<ImportRole>();
  for (const p of parts) {
    if (p === "bureau") roles.add("board");
    else if (p === "benevole") roles.add("volunteer");
    else if (["adherent", "membre"].includes(p)) continue;
    else return "invalid";
  }
  return [...roles];
}

/** Lecture d'un CSV (séparateur « ; » ou « , » détecté, guillemets gérés). */
export function parseCsv(content: string): string[][] {
  const textContent = content.replace(/^﻿/, "");
  const firstLine = textContent.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < textContent.length; i++) {
    const c = textContent[i];
    if (quoted) {
      if (c === '"' && textContent[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && textContent[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Transforme les lignes (première ligne = en-têtes) en adhérents à importer.
 * `teams` : noms des équipes existantes, pour valider la colonne « equipe ».
 */
export function parseMemberSheet(
  rows: unknown[][],
  teams: string[],
): { members: ImportedMember[]; errors: string[] } {
  const header = (rows[0] ?? []).map(normalize);
  const index = Object.fromEntries(
    (Object.keys(COLUMNS) as Column[]).map((key) => [
      key,
      header.findIndex((h) => (COLUMNS[key] as readonly string[]).includes(h)),
    ]),
  ) as Record<Column, number>;

  const missing = REQUIRED.filter((k) => index[k] < 0);
  if (missing.length) {
    return {
      members: [],
      errors: [`Colonnes obligatoires introuvables : ${missing.map((k) => `« ${COLUMNS[k][0]} »`).join(", ")}.`],
    };
  }

  const teamByKey = new Map(teams.map((t) => [normalize(t).replace(/^smdt ?\/ ?/, ""), t]));
  const members: ImportedMember[] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const cell = (key: Column) => (index[key] >= 0 ? row[index[key]] : null);
    if (row.every((c) => text(c) === null)) return;

    const problems: string[] = [];
    const email = normalize(cell("email"));
    const lastName = text(cell("lastName"));
    const firstName = text(cell("firstName"));
    const sex = parseSex(cell("sex"));
    if (!EMAIL_RE.test(email)) problems.push("email invalide");
    if (!lastName) problems.push("nom manquant");
    if (!firstName) problems.push("prénom manquant");
    if (!sex) problems.push("sexe invalide (F ou M)");

    const teamText = text(cell("team"));
    const team = teamText ? (teamByKey.get(normalize(teamText).replace(/^smdt ?\/ ?/, "")) ?? null) : null;
    if (teamText && !team) problems.push(`équipe inconnue « ${teamText} »`);

    const captain = yesNo(cell("captain"));
    if (captain === "invalid") problems.push("capitaine : oui ou non");
    if (captain === true && !teamText) problems.push("capitaine sans équipe");

    const roles = parseRoles(cell("roles"));
    if (roles === "invalid") problems.push("rôles : bureau et/ou benevole");

    const dues = yesNo(cell("duesPaid"));
    if (dues === "invalid") problems.push("cotisation : oui ou non");

    const levelText = text(cell("level"));
    const level = levelText === null ? null : Number(levelText.replace(",", "."));
    if (level !== null && !(Number.isInteger(level) && level >= 1 && level <= 5)) problems.push("niveau : 1 à 5");

    if (email && seen.has(email)) problems.push(`email déjà présent ligne ${seen.get(email)}`);
    else if (email) seen.set(email, line);

    if (problems.length) {
      errors.push(`Ligne ${line} : ${problems.join(", ")}.`);
      return;
    }

    members.push({
      line,
      email,
      lastName: lastName!,
      firstName: firstName!,
      sex: sex!,
      team,
      captain: captain === true,
      roles: roles as ImportRole[],
      phone: text(cell("phone")),
      license: text(cell("license")),
      duesPaid: dues as boolean | null,
      level,
    });
  });

  if (!members.length && !errors.length) errors.push("Aucun adhérent trouvé dans le fichier.");
  return { members, errors };
}
