import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIcs, parseTeams, reconcile, splitLocation, teamMatches, type ExistingMatch } from "./volley34";

const ICS = readFileSync(new URL("./__fixtures__/smdtx1.ics", import.meta.url), "utf8");

describe("parseIcs", () => {
  const events = parseIcs(ICS);
  it("lit les événements du flux volley34 (alarmes ignorées)", () => {
    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({
      uid: "2027-CE03485",
      startsAt: "2026-11-03T19:00:00.000Z",
      location: "Halle des Sports - Les Champs Noirs (St Mathieu de T.)",
      summary: "SMDT/Les St Loup reçoit MHSC/BEES",
    });
  });
  it("recolle les lignes repliées", () => {
    expect(events[3].location).toBe("Halle des sports Pierre de Coubertin (Lunel Viel)");
  });
});

describe("splitLocation", () => {
  it("sépare salle et ville", () => {
    expect(splitLocation("Salle Polyvalente (Vailhauquès)")).toEqual({ venue: "Salle Polyvalente", city: "Vailhauquès" });
    expect(splitLocation("Gymnase")).toEqual({ venue: "Gymnase", city: null });
  });
});

describe("teamMatches", () => {
  const matches = teamMatches(parseIcs(ICS), "SMDT/Les St Loup");
  it("déduit domicile / extérieur et l'adversaire", () => {
    expect(matches[0]).toMatchObject({ isHome: true, opponent: "MHSC/BEES", city: "St Mathieu de T." });
    expect(matches[1]).toMatchObject({ isHome: false, opponent: "VCV/Les diablotins", venue: "Salle Polyvalente", city: "Vailhauquès" });
  });
  it("ignore les événements d'autres équipes", () => {
    expect(teamMatches(parseIcs(ICS), "SMDT/Les Yoyos")).toEqual([]);
  });
});

describe("reconcile", () => {
  const remote = teamMatches(parseIcs(ICS), "SMDT/Les St Loup");
  const existing: ExistingMatch[] = [
    // Match aller importé d'Excel, sans référence volley34.
    { id: "aller", opponent: "MHSC/BEES", is_home: true, starts_at: "2026-11-03T19:00:00.000Z", volley34_ref: null },
    // Match retour déjà rattaché, reporté sur volley34.
    { id: "retour", opponent: "MHSC/BEES", is_home: false, starts_at: "2027-01-12T19:00:00.000Z", volley34_ref: "2027-CE03457" },
    // Match Excel absent du flux : conservé tel quel.
    { id: "absent", opponent: "OLAP/Caps ou pas Caps", is_home: false, starts_at: "2026-12-03T19:00:00.000Z", volley34_ref: null },
  ];
  const { updates, inserts } = reconcile(remote, existing);

  it("rattache par adversaire + domicile, puis par UID", () => {
    expect(updates.find((u) => u.id === "aller")).toMatchObject({ moved: false, match: { uid: "2027-CE03485" } });
    expect(updates.find((u) => u.id === "retour")).toMatchObject({ moved: true, match: { startsAt: "2027-01-11T19:00:00.000Z" } });
  });
  it("ajoute les matchs inconnus et ne touche pas aux autres", () => {
    expect(inserts.map((i) => i.opponent)).toEqual(["VCV/Les diablotins", "L2VB/Gaston Lagagne"]);
    expect(updates.some((u) => u.id === "absent")).toBe(false);
  });
});

describe("parseTeams", () => {
  it("extrait les équipes du club (XML)", () => {
    const xml = `<ArrayOfEquipe><Equipe><EquipeCode>SMDTX1</EquipeCode><ClubCode>SMDT</ClubCode><NomEquipe>SMDT/Les St Loup</NomEquipe></Equipe><Equipe><EquipeCode>VLMX9</EquipeCode><ClubCode>VLM</ClubCode><NomEquipe>VLM/5B Paf &amp; Passe!</NomEquipe></Equipe></ArrayOfEquipe>`;
    expect(parseTeams(xml, "SMDT")).toEqual([{ code: "SMDTX1", name: "SMDT/Les St Loup", clubCode: "SMDT" }]);
  });
  it("extrait les équipes du club (JSON)", () => {
    const json = JSON.stringify([
      { EquipeCode: "SMDTF1", ClubCode: "SMDT", NomEquipe: "SMDT/Totally Spike", Division: 1 },
      { EquipeCode: "VLM1", ClubCode: "VLM", NomEquipe: "VLM/1" },
    ]);
    expect(parseTeams(json, "SMDT")).toEqual([{ code: "SMDTF1", name: "SMDT/Totally Spike", clubCode: "SMDT" }]);
  });
});
