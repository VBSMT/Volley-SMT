import { describe, expect, it } from "vitest";
import { type GameCard, cardKey } from "./game";
import { type TeamWeek, matchdayTitle, simulatedWeek, cardScore, isLocked, lineupErrors, lineupScore, rank, teamWeek, weekStart } from "./game-week";

const card = (id: string, position: GameCard["position"], sex: "F" | "M" = "M", teamId = `t${id}`): GameCard => ({
  memberId: id,
  teamId,
  teamName: "",
  firstName: "",
  lastName: "",
  sex,
  position,
  rating: 60,
  bestRating: 60,
  photoVersion: null,
});
const pick = (c: GameCard) => ({ memberId: c.memberId, teamId: c.teamId });
const zero = { s30: 0, s31: 0, s32: 0, s23: 0, s13: 0, s03: 0, fWon: 0, fLost: 0 };
const totals = (scores: Partial<typeof zero>, sw = 0, sl = 0, pw = 0, pl = 0) => ({ scores: { ...zero, ...scores }, setsWon: sw, setsLost: sl, pointsWon: pw, pointsLost: pl });

describe("semaine", () => {
  it("titre de la journée", () => {
    expect(matchdayTitle("2026-11-02", "2026-09-01")).toBe("Compo Journée 10 — du 02/11 au 08/11");
    expect(matchdayTitle("2026-11-02", null)).toBe("Compo Journée 1 — du 02/11 au 08/11");
  });
  it("lundi de la semaine", () => {
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-04")).toBe("2026-11-02");
  });
});

describe("règles de l'équipe", () => {
  const s = card("1", "setter", "F"), l = card("2", "front_left"), r = card("3", "front_right"), b = card("4", "back"), x = card("5", "back");
  const owned = [s, l, r, b, x];
  it("équipe valide", () => expect(lineupErrors({ setter: pick(s), front_left: pick(l), front_right: pick(r), back: pick(b), sub: pick(x) }, owned)).toEqual([]));
  it("une fille au moins", () => {
    const m = card("1", "setter");
    expect(lineupErrors({ setter: pick(m), front_left: pick(l), front_right: pick(r), back: pick(b) }, [m, l, r, b])).toContain("Il faut au moins une fille parmi les titulaires.");
  });
  it("poste, collection, doublon, 2 par équipe", () => {
    expect(lineupErrors({ setter: pick(l), front_left: pick(l), front_right: pick(r), back: pick(b) }, owned)).toEqual(
      expect.arrayContaining(["Un joueur n'est pas à son poste.", "Un même joueur ne peut être aligné qu'une fois."]),
    );
    expect(lineupErrors({ setter: pick(card("9", "setter", "F")), front_left: pick(l), front_right: pick(r), back: pick(b) }, owned)).toContain("Carte absente de ta collection.");
    const same = [card("1", "setter", "F", "T"), card("2", "front_left", "M", "T"), card("3", "front_right", "M", "T"), b];
    expect(lineupErrors({ setter: pick(same[0]), front_left: pick(same[1]), front_right: pick(same[2]), back: pick(b) }, same)).toContain("Au plus 2 joueurs d'une même équipe.");
  });
  it("titulaire manquant", () => expect(lineupErrors({ setter: pick(s) }, owned)).toContain("Il faut un joueur à chaque poste."));
});

describe("résultats de la semaine", () => {
  it("matchs entre deux photos", () => {
    const w = teamWeek(totals({ s30: 1 }, 3, 0, 75, 50), totals({ s30: 1, s31: 1 }, 6, 1, 175, 140));
    expect(w).toEqual({ scores: ["s31"], setsWon: 3, setsLost: 1, pointsWon: 100, pointsLost: 90 });
  });
  it("pas de match", () => expect(teamWeek(totals({ s30: 1 }), totals({ s30: 1 }))).toBeNull());
});

describe("points d'une carte", () => {
  const w = { scores: ["s31" as const], setsWon: 3, setsLost: 1, pointsWon: 100, pointsLost: 78 };
  it("passe : +1 par set gagné", () => expect(cardScore("setter", w)).toEqual({ base: 8, bonus: 3 }));
  it("avant : +1 par 10 points d'écart", () => expect(cardScore("front_left", w)).toEqual({ base: 8, bonus: 2 }));
  it("avant : bonus plafonné à +4", () => expect(cardScore("front_right", { ...w, pointsWon: 100, pointsLost: 40 }).bonus).toBe(4));
  it("fond : +1 par set à moins de 20 points encaissés", () => {
    expect(cardScore("back", { ...w, setsConceded: [15, 19, 20, 24] }).bonus).toBe(2);
    // Sans le détail par set : moyenne 19,5 < 20 → +1 par set joué (4 sets).
    expect(cardScore("back", w)).toEqual({ base: 8, bonus: 4 });
    expect(cardScore("back", { ...w, pointsLost: 80 }).bonus).toBe(0);
  });
  it("replis sans les points", () => {
    expect(cardScore("front_right", { ...w, pointsWon: 0, pointsLost: 0 }).bonus).toBe(2);
    expect(cardScore("back", { scores: ["s23"], setsWon: 2, setsLost: 3, pointsWon: 0, pointsLost: 0 }).bonus).toBe(2);
  });
});

describe("points de l'équipe", () => {
  const s = card("1", "setter", "F"), l = card("2", "front_left"), r = card("3", "front_right"), b = card("4", "back"), x = card("5", "back");
  const positions = new Map([s, l, r, b, x].map((c) => [cardKey(c), { position: c.position, sex: c.sex, kind: "common" as const }]));
  const won = { scores: ["s30" as const], setsWon: 3, setsLost: 0, pointsWon: 0, pointsLost: 0 };
  const lineup = { setter: pick(s), front_left: pick(l), front_right: pick(r), back: pick(b), sub: pick(x) };
  it("remplaçant à 50 %", () => {
    const weeks = new Map([s, l, r, b, x].map((c) => [c.teamId, won]));
    const res = lineupScore(lineup, positions, weeks);
    // passe 10+3, avants 10+2 chacun, fond 10+0, remplaçant (fond) 10 × 50 %
    expect(res.total).toBe(13 + 12 + 12 + 10 + 5);
  });
  it("remplaçant à 100 % si un titulaire n'a pas joué", () => {
    const weeks = new Map([s, l, r, x].map((c) => [c.teamId, won]));
    const res = lineupScore(lineup, positions, weeks);
    expect(res.total).toBe(13 + 12 + 12 + 0 + 10);
    expect(res.slots.find((x) => x.slot === "sub")!.factor).toBe(1);
  });
});

describe("verrouillage et classement", () => {
  it("verrouillé au début du match", () => {
    const m = [{ teamId: "A", startsAt: "2026-11-04T19:00:00Z" }];
    expect(isLocked("A", m, new Date("2026-11-04T18:59:00Z"))).toBe(false);
    expect(isLocked("A", m, new Date("2026-11-04T19:00:00Z"))).toBe(true);
    expect(isLocked("B", m, new Date("2026-11-05T00:00:00Z"))).toBe(false);
  });
  it("égalité : bonus puis validation la plus tôt", () => {
    const r = rank([
      { ownerId: "a", total: 40, bonus: 5, validatedAt: "2026-11-03" },
      { ownerId: "b", total: 40, bonus: 7, validatedAt: "2026-11-04" },
      { ownerId: "c", total: 40, bonus: 7, validatedAt: "2026-11-02" },
      { ownerId: "d", total: 50, bonus: 0, validatedAt: "2026-11-05" },
    ]);
    expect(r.map((e) => e.ownerId)).toEqual(["d", "c", "b", "a"]);
  });
});

describe("résultats simulés", () => {
  it("sets déduits des scores", () => {
    expect(simulatedWeek(["s31", "s23"])).toEqual({ scores: ["s31", "s23"], setsWon: 5, setsLost: 4, pointsWon: 0, pointsLost: 0 });
    expect(simulatedWeek([])).toBeNull();
  });
});

describe("case Bonus : Capitaine et Légendes", () => {
  const s = card("1", "setter", "F"), l = card("2", "front_left", "F"), r = card("3", "front_right", "F"), b = card("4", "back", "F"), x = card("5", "back", "F");
  const cap: GameCard = { ...card("9", "setter", "M", "t1"), kind: "captain" };
  const leg: GameCard = { ...card("8", "setter", "M", ""), kind: "legend", legendBonus: "per_win" };
  const owned = [s, l, r, b, x, cap, leg];
  const pk = (c: GameCard) => ({ memberId: c.memberId, teamId: c.teamId, kind: c.kind ?? "common" });
  const base = { setter: pk(s), front_left: pk(l), front_right: pk(r), back: pk(b), sub: pk(x) };
  const info = (c: GameCard, legendBonus: GameCard["legendBonus"] = null) => [cardKey(c), { position: c.position, sex: c.sex, kind: c.kind ?? "common", legendBonus }] as const;
  const won3 = { scores: ["s30" as const], setsWon: 3, setsLost: 0, pointsWon: 75, pointsLost: 45 };
  const lost = { scores: ["s03" as const], setsWon: 0, setsLost: 3, pointsWon: 45, pointsLost: 75 };
  // passe 10+3, avants 10+3 chacun, fond 10+0 (15 encaissés/set < 20 → +3), remplaçant (fond) 13 × 50 %.
  const weeks = new Map<string, TeamWeek | null>([s, l, r, b, x, cap].map((c) => [c.teamId, won3]));

  it("règles de la case Bonus", () => {
    expect(lineupErrors({ ...base, bonus: pk(cap) }, owned)).toEqual([]);
    expect(lineupErrors({ ...base, bonus: pk(x) }, owned)).toContain("La case Bonus accueille un Capitaine ou une Légende.");
    expect(lineupErrors({ ...base, sub: pk(cap) }, owned)).toContain("Capitaines et Légendes vont dans la case Bonus.");
  });

  it("Capitaine : +5 %, +10 % si son équipe gagne", () => {
    const cards = new Map([...[s, l, r, b, x].map((c) => info(c)), info(cap)]);
    const plain = lineupScore(base, cards, weeks).total;
    expect(lineupScore({ ...base, bonus: pk(cap) }, cards, weeks).total).toBeCloseTo(plain * 1.1, 0);
    const capLost = new Map(weeks).set(cap.teamId, lost);
    expect(lineupScore({ ...base, bonus: pk(cap) }, cards, capLost).extra).toBeCloseTo(lineupScore(base, cards, capLost).total * 0.05, 0);
  });

  it("Légendes", () => {
    const withLegend = (bonus: GameCard["legendBonus"]) => new Map([...[s, l, r, b, x].map((c) => info(c)), info(leg, bonus)]);
    const plain = lineupScore(base, withLegend(null), weeks);
    const run = (bonus: GameCard["legendBonus"]) => lineupScore({ ...base, bonus: pk(leg) }, withLegend(bonus), weeks);
    expect(run("per_win").extra).toBe(8);
    expect(run("five_girls").extra).toBe(8);
    expect(run("setter_x4").total - plain.total).toBe(9); // bonus passe 3 → 12
    expect(run("back_x5").total - plain.total).toBe(12); // bonus fond 3 → 15
    expect(run("front_x2_5").total - plain.total).toBe(9); // 2 avants : 3 → 7,5
    expect(run("bench_x2").total - plain.total).toBe(6.5); // remplaçant 50 % → 100 %
    expect(run("all_win_30").extra).toBeCloseTo(0.3 * (13 * 4), 1);
  });
});
