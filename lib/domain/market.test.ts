import { describe, expect, it } from "vitest";
import { listingErrors, offerErrors } from "./market";

const c = (kind: "common" | "rare" | "captain" | "legend", id = "m") => ({ memberId: id, teamId: "t", kind });

describe("marché VUT", () => {
  it("annonce : prix minimum 3 / 12 / 75, carte demandée de même rareté, pas de Légende", () => {
    expect(listingErrors("common", 3, null)).toEqual([]);
    expect(listingErrors("rare", 11, null)).toEqual(["Prix minimum : ✦ 12."]);
    expect(listingErrors("captain", null, c("captain"))).toEqual([]);
    expect(listingErrors("rare", null, c("common"))).toEqual(["La carte demandée doit être de même rareté."]);
    expect(listingErrors("legend", 99, null)).toEqual(["Les Légendes ne s'échangent pas."]);
    expect(listingErrors("common", null, null)).toHaveLength(1);
  });
  it("offre : éclats seuls ≥ minimum", () => {
    expect(offerErrors("rare", 12, [])).toEqual([]);
    expect(offerErrors("rare", 5, [])).toEqual(["Offre minimum : ✦ 12."]);
  });
  it("offre : une carte de même rareté, ou plusieurs moins rares (+ éclats)", () => {
    expect(offerErrors("rare", 0, [c("rare")])).toEqual([]);
    expect(offerErrors("captain", 10, [c("rare", "a"), c("common", "b"), c("rare", "c")])).toEqual([]);
    expect(offerErrors("rare", 0, [c("rare", "a"), c("rare", "b")])).toHaveLength(1);
    expect(offerErrors("rare", 0, [c("rare", "a"), c("common", "b")])).toHaveLength(1);
    expect(offerErrors("common", 0, [c("rare")])).toEqual(["On ne propose pas une carte plus rare."]);
    expect(offerErrors("captain", 0, [c("legend")])).toEqual(["Les Légendes ne s'échangent pas."]);
  });
});
