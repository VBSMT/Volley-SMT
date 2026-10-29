import { describe, expect, it } from "vitest";
import { buildLineup, manualLineup, planTeams, type LineupPlayer, type Position } from "./lineup";

describe("planTeams — exemples de CLAUDE.md (T = 3)", () => {
  const cases: [number, number[], boolean][] = [
    [9, [5, 4], false], // 2 équipes (4+5)
    [12, [4, 4, 4], true], // 3×4 en rotation
    [16, [4, 4, 4, 4], false], // 4×4
    [20, [4, 4, 4, 4, 4], true], // 5×4 en rotation
    [23, [5, 5, 5, 4, 4], true], // 5 équipes (5,5,5,4,4)
    [28, [4, 4, 4, 4, 4, 4, 4], true], // 7×4
  ];
  it.each(cases)("%i présents → %j", (present, sizes, rotation) => {
    const plan = planTeams(present, 3);
    expect(plan.sizes).toEqual(sizes);
    expect(plan.rotation).toBe(rotation);
    expect(plan.overflow).toBe(false);
  });

  it("50 présents → 7 équipes de 7–8 (débordement)", () => {
    const plan = planTeams(50, 3);
    expect(plan.n).toBe(7);
    expect(plan.overflow).toBe(true);
    expect(Math.min(...plan.sizes)).toBe(7);
    expect(Math.max(...plan.sizes)).toBe(8);
  });

  it("moins de 8 présents : 2 équipes et alerte", () => {
    expect(planTeams(6, 3)).toMatchObject({ n: 2, sizes: [3, 3], tooFew: true });
  });

  it("aucun terrain ou aucun présent : pas d'équipe", () => {
    expect(planTeams(12, 0).n).toBe(0);
    expect(planTeams(0, 3).n).toBe(0);
  });

  it("respecte toujours 4 à 6 joueurs hors débordement, sur tous les cas T = 1 à 3", () => {
    for (let t = 1; t <= 3; t++) {
      for (let p = 8; p <= 6 * (2 * t + 1); p++) {
        const plan = planTeams(p, t);
        expect(plan.sizes.reduce((a, b) => a + b, 0)).toBe(p);
        expect(Math.min(...plan.sizes)).toBeGreaterThanOrEqual(4);
        expect(Math.max(...plan.sizes)).toBeLessThanOrEqual(6);
        expect(plan.n).toBeLessThanOrEqual(2 * t + 1);
      }
    }
  });
});

const player = (id: string, sex: "F" | "M", level: number | null, p1: Position | null = "front", p2: Position | null = null): LineupPlayer => ({
  id, sex, level, position1: p1, position2: p2,
});

describe("buildLineup", () => {
  it("équilibre les sommes de niveaux", () => {
    const players = [5, 5, 4, 4, 3, 3, 2, 2].map((lvl, i) => player(`p${i}`, i % 2 ? "F" : "M", lvl, i < 2 ? "setter" : "back"));
    const { teams } = buildLineup(players, 1);
    expect(teams).toHaveLength(2);
    expect(teams[0].levelSum).toBe(teams[1].levelSum);
  });

  it("met au moins une fille par équipe quand c'est possible", () => {
    // 4 filles faibles, 12 garçons : sans contrainte, le serpent les regrouperait.
    const players = [
      ...Array.from({ length: 12 }, (_, i) => player(`m${i}`, "M", 3)),
      ...Array.from({ length: 4 }, (_, i) => player(`f${i}`, "F", 3)),
    ];
    const { teams, warnings } = buildLineup(players, 2);
    expect(teams).toHaveLength(4);
    teams.forEach((t) => expect(t.girls).toBe(1));
    expect(warnings.some((w) => w.includes("sans fille"))).toBe(false);
  });

  it("au plus une fille par équipe s'il y a moins de filles que d'équipes", () => {
    const players = [
      ...Array.from({ length: 14 }, (_, i) => player(`m${i}`, "M", 3)),
      player("f0", "F", 3),
      player("f1", "F", 3),
    ];
    const { teams } = buildLineup(players, 2);
    teams.forEach((t) => expect(t.girls).toBeLessThanOrEqual(1));
  });

  it("répartit les passeurs, à niveaux et filles égaux", () => {
    const players = [
      ...["s0", "s1"].map((id) => player(id, "M", 3, "setter")),
      ...Array.from({ length: 6 }, (_, i) => player(`a${i}`, "M", 3, "front", "back")),
    ];
    const { teams, warnings } = buildLineup(players, 1);
    for (const t of teams) expect(t.players.filter((id) => id.startsWith("s"))).toHaveLength(1);
    expect(warnings.some((w) => w.includes("sans passeur"))).toBe(false);
  });

  it("remonte les contraintes non tenues et les niveaux manquants", () => {
    const players = Array.from({ length: 8 }, (_, i) => player(`m${i}`, "M", i === 0 ? null : 3, "front"));
    const { warnings } = buildLineup(players, 1);
    expect(warnings).toContain("1 présent sans niveau (compté 3).");
    expect(warnings).toContain("Équipe 1 sans passeur.");
    expect(warnings).toContain("Équipe 2 sans joueur de fond.");
  });

  it("chaque présent est placé exactement une fois", () => {
    const players = Array.from({ length: 23 }, (_, i) => player(`p${i}`, i % 4 === 0 ? "F" : "M", (i % 5) + 1, i % 3 === 0 ? "setter" : "back"));
    const { teams } = buildLineup(players, 3);
    const ids = teams.flatMap((t) => t.players).sort();
    expect(ids).toEqual(players.map((p) => p.id).sort());
    expect(teams.map((t) => t.players.length)).toEqual([5, 5, 5, 4, 4]);
  });
});

describe("compo modifiée à la main", () => {
  const p = (id: string, sex: "F" | "M", level: number, position1: "setter" | "front" | "back" | null): LineupPlayer => ({
    id,
    sex,
    level,
    position1,
    position2: null,
  });
  it("recalcule totaux et alertes sans changer la répartition", () => {
    const r = manualLineup([
      [p("a", "F", 5, "setter"), p("b", "M", 4, "back")],
      [p("c", "M", 1, "front"), p("d", "M", 1, "front")],
    ]);
    expect(r.teams.map((t) => t.players)).toEqual([["a", "b"], ["c", "d"]]);
    expect(r.teams.map((t) => t.levelSum)).toEqual([9, 2]);
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        "Écart de niveau de 7 entre la plus forte et la plus faible équipe.",
        "Équipe 2 sans passeur.",
        "Équipe 2 sans joueur de fond.",
      ]),
    );
  });
  it("signale une équipe vidée", () => {
    expect(manualLineup([[p("a", "F", 3, "setter")], []]).warnings).toContain("Équipe 2 vide.");
  });
});
