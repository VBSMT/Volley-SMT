import { describe, expect, it } from "vitest";
import { attendanceTotals, canSeeEvent, visibilityLabel, volunteerCoverage } from "./events";

describe("canSeeEvent", () => {
  it("ouvert à tous quand aucun rôle n'est choisi", () => {
    expect(canSeeEvent([], ["member"])).toBe(true);
  });
  it("au moins un des rôles choisis", () => {
    expect(canSeeEvent(["captain", "volunteer"], ["member", "volunteer"])).toBe(true);
    expect(canSeeEvent(["captain", "volunteer"], ["member"])).toBe(false);
  });
  it("le Bureau voit toujours tout", () => {
    expect(canSeeEvent(["volunteer"], ["board"])).toBe(true);
  });
  it("décrit la visibilité", () => {
    expect(visibilityLabel([])).toBe("Tous les adhérents");
    expect(visibilityLabel(["volunteer", "captain"])).toBe("Capitaines, Bénévoles");
  });
});

describe("attendanceTotals", () => {
  it("compte adhérents, conjoint·es, enfants et invités de ceux qui viennent", () => {
    expect(
      attendanceTotals([
        { coming: true, with_partner: true, children: 2, guests: 0 },
        { coming: true, with_partner: false, children: null, guests: 1 },
        { coming: false, with_partner: true, children: 3, guests: 2 },
      ]),
    ).toEqual({ members: 2, partners: 1, children: 2, guests: 1, total: 6, notComing: 1 });
  });
});

describe("volunteerCoverage", () => {
  it("compte les disponibles par poste", () => {
    const res = volunteerCoverage(
      [{ id: "b", label: "buvette", needed: 4 }, { id: "a", label: "arbitrage", needed: 1 }],
      [
        { available: true, need_id: "b" },
        { available: true, need_id: "b" },
        { available: false, need_id: "b" },
        { available: true, need_id: "a" },
        { available: true, need_id: "a" },
      ],
    );
    expect(res.map((r) => [r.label, r.filled, r.missing])).toEqual([["buvette", 2, 2], ["arbitrage", 2, 0]]);
  });
});
