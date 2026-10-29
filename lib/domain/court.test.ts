import { describe, expect, it } from "vitest";
import { placeOnCourt } from "./court";

describe("placement sur le terrain", () => {
  const p = (id: string, position1: "setter" | "front" | "back" | null) => ({ id, position1 });
  it("place par poste 1 et alterne les avants gauche / droite", () => {
    const c = placeOnCourt([p("a", "setter"), p("b", "front"), p("c", "front"), p("d", "back"), p("e", "front")]);
    expect(c.passe.map((x) => x.id)).toEqual(["a"]);
    expect(c.avantG.map((x) => x.id)).toEqual(["b", "e"]);
    expect(c.avantD.map((x) => x.id)).toEqual(["c"]);
    expect(c.fond.map((x) => x.id)).toEqual(["d"]);
  });
  it("superpose et place au hasard les joueurs sans poste", () => {
    const c = placeOnCourt([p("a", "setter"), p("x", null), p("y", null)], () => 0.99);
    expect(c.fond.map((x) => x.id)).toEqual(["x", "y"]);
    expect(Object.values(c).flat()).toHaveLength(3);
  });
});

describe("avants (2) et (4)", () => {
  it("place Avant (2) à droite et Avant (4) à gauche", () => {
    const c = placeOnCourt([
      { id: "d", position1: "front_right" as const },
      { id: "g", position1: "front_left" as const },
      { id: "x", position1: "front" as const },
    ]);
    expect(c.avantD[0].id).toBe("d");
    expect(c.avantG[0].id).toBe("g");
    expect([...c.avantG, ...c.avantD].map((p) => p.id).sort()).toEqual(["d", "g", "x"]);
  });
});
