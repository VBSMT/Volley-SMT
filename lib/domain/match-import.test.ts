import { describe, expect, it } from "vitest";
import { parseMatchSheet } from "./match-import";
import { parisWallTimeToUtc } from "./paris-time";

const HEADER = [
  "Date", "Heure", "Jour", "Championnat", "Niveau / Poule", "Phase", "Journée", "Équipe SMDT",
  "Dom./Ext.", "Adversaire", "Équipe qui reçoit", "Équipe qui se déplace", "Salle", "Ville",
];
// Format renvoyé par read-excel-file : composantes UTC = heure murale.
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const time = (h: number, min = 0) => new Date(Date.UTC(1899, 11, 30, h, min));

const row = (overrides: Partial<Record<string, unknown>> = {}) => {
  const base: Record<string, unknown> = {
    Date: day(2026, 11, 3), Heure: time(20), Jour: "Mardi", Championnat: "4x4 Mixte",
    "Niveau / Poule": "Niveau 2 - Poule : 1", Phase: "Aller", "Journée": 1,
    "Équipe SMDT": "SMDT/Les St Loup", "Dom./Ext.": "Domicile", Adversaire: "MHSC/BEES",
    "Équipe qui reçoit": "SMDT/Les St Loup", "Équipe qui se déplace": "MHSC/BEES",
    Salle: "Halle des Sports - Les Champs Noirs", Ville: "St Mathieu de Tréviers",
  };
  const merged = { ...base, ...overrides };
  return HEADER.map((h) => merged[h]);
};

describe("parisWallTimeToUtc", () => {
  it("gère l'heure d'hiver (UTC+1)", () => {
    expect(parisWallTimeToUtc(2026, 11, 3, 20, 0).toISOString()).toBe("2026-11-03T19:00:00.000Z");
  });
  it("gère l'heure d'été (UTC+2)", () => {
    expect(parisWallTimeToUtc(2027, 3, 30, 20, 0).toISOString()).toBe("2027-03-30T18:00:00.000Z");
  });
});

describe("parseMatchSheet", () => {
  it("lit une ligne du fichier du club", () => {
    const { matches, errors } = parseMatchSheet([HEADER, row()]);
    expect(errors).toEqual([]);
    expect(matches).toEqual([
      {
        teamName: "Les St Loup",
        competition: "4x4 Mixte",
        division: "Niveau 2 - Poule : 1",
        phase: "Aller",
        round: 1,
        isHome: true,
        opponent: "MHSC/BEES",
        venue: "Halle des Sports - Les Champs Noirs",
        city: "St Mathieu de Tréviers",
        startsAt: "2026-11-03T19:00:00.000Z",
      },
    ]);
  });

  it("lit les matchs à l'extérieur et les horaires avec minutes", () => {
    const { matches } = parseMatchSheet([
      HEADER,
      row({ "Dom./Ext.": "Extérieur", Heure: time(20, 30), Date: day(2026, 11, 4) }),
    ]);
    expect(matches[0].isHome).toBe(false);
    expect(matches[0].startsAt).toBe("2026-11-04T19:30:00.000Z");
  });

  it("repère les colonnes par leur titre, quel que soit l'ordre", () => {
    const reversed = [[...HEADER].reverse(), [...row()].reverse()];
    expect(parseMatchSheet(reversed).matches).toHaveLength(1);
  });

  it("signale les colonnes manquantes", () => {
    const { matches, errors } = parseMatchSheet([["Date", "Heure"], [day(2026, 11, 3), time(20)]]);
    expect(matches).toEqual([]);
    expect(errors[0]).toMatch(/Colonnes introuvables/);
  });

  it("signale les lignes invalides et ignore les lignes vides", () => {
    const { matches, errors } = parseMatchSheet([
      HEADER,
      row({ Date: "pas une date", "Journée": 2 }),
      HEADER.map(() => null),
      row({ "Journée": 3 }),
    ]);
    expect(matches).toHaveLength(1);
    expect(errors).toEqual(["Ligne 2 : date invalide."]);
  });

  it("distingue la même journée en phase Aller et Retour", () => {
    const { matches, errors } = parseMatchSheet([HEADER, row(), row({ Phase: "Retour" })]);
    expect(errors).toEqual([]);
    expect(matches).toHaveLength(2);
  });

  it("refuse une journée en double pour la même équipe", () => {
    const { matches, errors } = parseMatchSheet([HEADER, row(), row()]);
    expect(matches).toHaveLength(1);
    expect(errors[0]).toMatch(/en double/);
  });
});
