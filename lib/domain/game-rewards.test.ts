import { describe, expect, it } from "vitest";
import type { GameCard } from "./game";
import { dailyState, inSeason, podiumVisible, rewardReason, shardPrice, shardsFromOpening, trainingRewardsDue } from "./game-rewards";

const card = (id: string, kind: GameCard["kind"] = "common"): GameCard => ({
  memberId: id,
  teamId: "t",
  kind,
  teamName: "",
  firstName: "",
  lastName: "",
  sex: "M",
  position: "setter",
  rating: 60,
  bestRating: 60,
  photoVersion: null,
});

describe("récompenses", () => {
  it("un booster tous les 3 entraînements", () => {
    expect(trainingRewardsDue(2, 0)).toEqual([]);
    expect(trainingRewardsDue(3, 0)).toEqual([1]);
    expect(trainingRewardsDue(7, 1)).toEqual([2]);
    expect(trainingRewardsDue(9, 1)).toEqual([2, 3]);
    expect(trainingRewardsDue(9, 3)).toEqual([]);
  });
  it("prix à la banque : commune 5, rare 20, Capitaine 100, Légende jamais", () => {
    expect(shardPrice(card("a"))).toBe(5);
    expect(shardPrice(card("a", "rare"))).toBe(20);
    expect(shardPrice(card("a", "captain"))).toBe(100);
    expect(shardPrice(card("a", "legend"))).toBeNull();
  });
  it("raisons uniques", () => {
    expect(rewardReason.week("2026-11-02")).toBe("week:2026-11-02");
    expect(rewardReason.training(2)).toBe("training:2");
  });
  it("éclats : doublons avec la collection et dans le même booster", () => {
    const owned = new Set(["common:a:t"]);
    expect(shardsFromOpening(owned, [card("a"), card("b")])).toBe(1);
    expect(shardsFromOpening(owned, [card("b"), card("b"), card("b")])).toBe(2);
    expect(shardsFromOpening(owned, [card("a", "rare")])).toBe(0);
  });
});

describe("fin de saison", () => {
  it("podium 7 jours après la fin", () => {
    expect(podiumVisible("2027-06-30", "2027-06-30")).toBe(false);
    expect(podiumVisible("2027-06-30", "2027-07-01")).toBe(true);
    expect(podiumVisible("2027-06-30", "2027-07-07")).toBe(true);
    expect(podiumVisible("2027-06-30", "2027-07-08")).toBe(false);
  });
  it("semaines de la saison", () => {
    const s = { startsOn: "2026-09-02", endsOn: "2027-06-30" };
    expect(inSeason("2026-08-31", s)).toBe(true); // semaine du début de saison
    expect(inSeason("2026-08-24", s)).toBe(false);
    expect(inSeason("2027-07-05", s)).toBe(false);
  });
});

describe("booster du jour et série", () => {
  const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  it("premier jour", () => expect(dailyState([], "2026-11-03")).toEqual({ claimedToday: false, streak: 0, dayInCycle: 1, bonusToday: false }));
  it("4ᵉ jour à récupérer après 3 jours de suite", () => {
    expect(dailyState(days("2026-11-01", 3), "2026-11-04")).toMatchObject({ claimedToday: false, streak: 3, dayInCycle: 4 });
  });
  it("déjà récupéré aujourd'hui", () => expect(dailyState(days("2026-11-01", 4), "2026-11-04")).toMatchObject({ claimedToday: true, streak: 4, dayInCycle: 4 }));
  it("7ᵉ jour : bonus, puis la série repart", () => {
    expect(dailyState(days("2026-11-01", 6), "2026-11-07").bonusToday).toBe(true);
    expect(dailyState(days("2026-11-01", 7), "2026-11-08")).toMatchObject({ dayInCycle: 1, bonusToday: false });
    expect(dailyState(days("2026-11-01", 13), "2026-11-14").bonusToday).toBe(true);
  });
  it("un jour manqué remet à zéro", () => expect(dailyState(["2026-11-01", "2026-11-02"], "2026-11-04")).toMatchObject({ streak: 0, dayInCycle: 1 }));
});
