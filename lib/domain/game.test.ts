import { describe, expect, it } from "vitest";
import {
  type GameCard,
  type GamePosition,
  drawEarned,
  drawStarter,
  formRating,
  gamePosition,
  isValidStarter,
  nextForm,
  tierOf,
} from "./game";

const zero = { s30: 0, s31: 0, s32: 0, s23: 0, s13: 0, s03: 0, fWon: 0, fLost: 0 };

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

const POS: GamePosition[] = ["setter", "front_left", "front_right", "back"];
function club(teams = 9, perTeam = 7): GameCard[] {
  const cards: GameCard[] = [];
  for (let t = 0; t < teams; t++)
    for (let i = 0; i < perTeam; i++)
      cards.push({
        memberId: `m${t}-${i}`,
        teamId: `t${t}`,
        teamName: `Équipe ${t}`,
        firstName: "A",
        lastName: "B",
        sex: (t * perTeam + i) % 5 === 0 ? "F" : "M",
        position: POS[(t + i) % 4],
        rating: 60,
        bestRating: 60,
        photoVersion: null,
      });
  return cards;
}

describe("note de forme", () => {
  it("60 avant le premier match", () => expect(formRating([])).toBe(60));
  it("moyenne des matchs joués s'il y en a moins de 5", () => {
    expect(formRating([10])).toBe(99);
    expect(formRating([8, 6, 3])).toBe(73);
  });
  it("5 derniers matchs seulement", () => {
    expect(formRating([0, 10, 10, 10, 10, 10])).toBe(99);
    expect(formRating([0, 0, 0, 0, 0])).toBe(40);
  });
  it("paliers or / argent / bronze", () => {
    expect(tierOf(80)).toBe("gold");
    expect(tierOf(79)).toBe("silver");
    expect(tierOf(65)).toBe("silver");
    expect(tierOf(64)).toBe("bronze");
  });
  it("ajoute les matchs apparus depuis la photo précédente", () => {
    const first = nextForm(null, { ...zero, s31: 1 });
    expect(first.recent).toEqual([8]);
    const same = nextForm(first, { ...zero, s31: 1 });
    expect(same.recent).toEqual([8]);
    const next = nextForm(same, { ...zero, s31: 1, s03: 1 });
    expect(next.recent).toEqual([8, 0]);
    expect(next.rating).toBe(64);
    expect(next.bestRating).toBe(87);
  });
});

describe("postes du jeu", () => {
  it("l'avant sans côté devient Avant (4)", () => {
    expect(gamePosition("front")).toBe("front_left");
    expect(gamePosition("back")).toBe("back");
    expect(gamePosition(null)).toBeNull();
  });
});

describe("booster de départ", () => {
  it("respecte toutes les règles", () => {
    const pool = club();
    for (let s = 1; s <= 50; s++) expect(isValidStarter(drawStarter(pool, seeded(s)))).toBe(true);
  });
  it("trouve la seule fille du club", () => {
    const pool = club().map((c) => ({ ...c, sex: c.memberId === "m8-6" ? ("F" as const) : ("M" as const) }));
    const starter = drawStarter(pool, seeded(7));
    expect(starter.some((c) => c.memberId === "m8-6")).toBe(true);
    expect(isValidStarter(starter)).toBe(true);
  });
  it("un joueur de deux équipes n'apparaît qu'une fois", () => {
    const pool = club(3, 2);
    pool.push({ ...pool[0], teamId: "t1" });
    for (let s = 1; s <= 20; s++) {
      const ids = drawStarter(pool, seeded(s)).map((c) => c.memberId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it("meilleur tirage possible si le club est trop petit", () => {
    const starter = drawStarter(club(1, 3), seeded(3));
    expect(starter).toHaveLength(3);
  });
});

describe("booster gagné", () => {
  it("2 ou 3 cartes, doublons possibles", () => {
    const pool = club(1, 1);
    const sizes = new Set<number>();
    for (let s = 1; s <= 30; s++) {
      const cards = drawEarned(pool, seeded(s));
      sizes.add(cards.length);
      expect(cards.every((c) => c.memberId === "m0-0")).toBe(true);
    }
    expect([...sizes].sort()).toEqual([2, 3]);
  });
});
