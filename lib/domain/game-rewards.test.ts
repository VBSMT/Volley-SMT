import { describe, expect, it } from "vitest";
import type { GameCard } from "./game";
import { inSeason, podiumVisible, rewardReason, shardsFromOpening, trainingRewardsDue } from "./game-rewards";

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
