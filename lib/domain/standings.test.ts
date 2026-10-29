import { describe, expect, it } from "vitest";
import { parseStandings, poolOf, poolTitle, zoneOf } from "./standings";

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
  });
  it("nomme la poule", () => {
    expect(poolTitle("2", "1")).toBe("Niveau 2 - Poule 1");
    expect(poolTitle("5", "0")).toBe("Niveau 5");
  });
});
