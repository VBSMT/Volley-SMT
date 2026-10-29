import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseStandings, poolOf, poolTitle, recentForm, seasonNotStarted, zoneOf } from "./standings";

const REAL = readFileSync(new URL("./__fixtures__/classement-smdtx1.xml", import.meta.url), "utf8");

const XML = `<ArrayOfClassement xmlns="http://schemas.datacontract.org/2004/07/Volley34.Data.Entities">
<Classement><ClassementCode>2027-C004-2-1</ClassementCode><CodeCompetition>2027-C004</CodeCompetition><Division>2</Division><Poule>1</Poule><EquipeCode>LAMVACX1</EquipeCode><Nom>MHSC/BEES</Nom><Rang>1</Rang><Joue>2</Joue><Gagne>2</Gagne><Perdu>0</Perdu><Forfait>0</Forfait><Total>6</Total><SefDiff>5</SefDiff><PointDiff>40</PointDiff></Classement>
<Classement><ClassementCode>2027-C004-2-1</ClassementCode><CodeCompetition>2027-C004</CodeCompetition><Division>2</Division><Poule>1</Poule><EquipeCode>SMDTX1</EquipeCode><Nom>SMDT/Les St Loup</Nom><Rang>2</Rang><Joue>2</Joue><Gagne>1</Gagne><Perdu>1</Perdu><Forfait>0</Forfait><Total>4</Total><SefDiff>0</SefDiff><PointDiff>-3</PointDiff></Classement>
<Classement><ClassementCode>2027-C004-3-1</ClassementCode><CodeCompetition>2027-C004</CodeCompetition><Division>3</Division><Poule>1</Poule><Nom>SMDT/Les Desperados</Nom><Rang>1</Rang><Joue>1</Joue><Gagne>1</Gagne><Perdu>0</Perdu><Forfait>0</Forfait><Total>3</Total><SefDiff>2</SefDiff><PointDiff>12</PointDiff></Classement>
</ArrayOfClassement>`;

describe("parseStandings", () => {
  it("lit le XML de l'API (champs du site volley34)", () => {
    const rows = parseStandings(XML);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({
      rank: 2, name: "SMDT/Les St Loup", code: "SMDTX1", played: 2, won: 1, lost: 1,
      points: 4, setDiff: 0, pointDiff: -3, division: "2", pool: "1", group: "2027-C004-2-1",
    });
  });
  it("lit aussi le JSON (format du service du site)", () => {
    const rows = parseStandings(JSON.stringify({ d: { Classements: [{ Rang: 1, Nom: "SMDT/Les XiV", Joue: 1, Gagne: 1, Perdu: 0, Total: 3, SefDiff: 2, PointDiff: 10, Division: "5", Poule: "0", ClassementCode: "X" }] } }));
    expect(rows[0]).toMatchObject({ rank: 1, name: "SMDT/Les XiV", setDiff: 2 });
  });
  it("renvoie une liste vide quand il n'y a pas encore de classement", () => {
    expect(parseStandings('<ArrayOfClassement xmlns:i="x" />')).toEqual([]);
    expect(parseStandings("")).toEqual([]);
  });
});

describe("parseStandings — format réel de l'API", () => {
  const rows = parseStandings(REAL);
  it("lit les lignes de la poule et les infos de l'en-tête (montées, descentes)", () => {
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({
      rank: 2, name: "SMDT/Les St Loup", code: "SMDTX1", played: 3, won: 2, lost: 1, points: 7,
      setsWon: 8, setsLost: 5, setDiff: 3, pointsWon: 290, pointsLost: 265, pointDiff: 25,
      division: "2", pool: "1", group: "2027-C004-2-1", competition: "Championnat 2027 - Mixte 4x4",
      promoted: 2, relegated: 2,
    });
  });
  it("lit la répartition des scores", () => {
    expect(rows[1].scores).toEqual({ s30: 1, s31: 0, s32: 1, s23: 0, s13: 1, s03: 0, fWon: 0, fLost: 0 });
  });
  it("détecte une saison pas encore commencée", () => {
    expect(seasonNotStarted(rows)).toBe(false);
    expect(seasonNotStarted(rows.map((r) => ({ ...r, played: 0 })))).toBe(true);
  });
});

describe("recentForm", () => {
  it("déduit victoires et défaites des photos successives", () => {
    const snaps = [
      { takenOn: "2026-11-02", won: 0, lost: 0 },
      { takenOn: "2026-11-04", won: 1, lost: 0 },
      { takenOn: "2026-11-05", won: 1, lost: 0 },
      { takenOn: "2026-11-11", won: 1, lost: 1 },
      { takenOn: "2026-11-18", won: 2, lost: 1 },
    ];
    expect(recentForm(snaps).map((f) => f.result).join("")).toBe("VDV");
    expect(recentForm(snaps, 2).map((f) => f.result).join("")).toBe("DV");
  });
});

describe("poolOf", () => {
  const rows = parseStandings(XML);
  it("retrouve la poule par code, sinon par nom", () => {
    expect(poolOf(rows, { code: "SMDTX1", fullName: "x" }).map((r) => r.rank)).toEqual([1, 2]);
    expect(poolOf(rows, { code: null, fullName: "SMDT/Les Desperados" })).toHaveLength(1);
    expect(poolOf(rows, { code: null, fullName: "SMDT/Inconnue" })).toEqual([]);
  });
});

describe("zones et titres", () => {
  it("podium en niveau 1, montée sinon, descente pour les 2 derniers", () => {
    expect([1, 2, 3, 4, 7, 8].map((r) => zoneOf(r, 8, "1"))).toEqual(["gold", "silver", "bronze", null, "relegation", "relegation"]);
    expect([1, 2, 3, 7].map((r) => zoneOf(r, 8, "3"))).toEqual(["promotion", "promotion", null, "relegation"]);
    // Nombres fournis par la poule : 1 montée, 3 descentes.
    expect([1, 2, 5, 6].map((r) => zoneOf(r, 8, "3", { promoted: 1, relegated: 3 }))).toEqual(["promotion", null, null, "relegation"]);
  });
  it("nomme la poule", () => {
    expect(poolTitle("2", "1")).toBe("Niveau 2 - Poule 1");
    expect(poolTitle("5", "0")).toBe("Niveau 5");
  });
});
