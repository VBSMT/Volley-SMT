import { describe, expect, it } from "vitest";
import { canTransition, isConfirmedBySync, isExpired, nextStatuses } from "./reschedule";

describe("transitions de report", () => {
  it("le capitaine ne peut qu'abandonner", () => {
    expect(nextStatuses("requested", "captain")).toEqual(["abandoned"]);
    expect(nextStatuses("approved", "captain")).toEqual(["abandoned"]);
    expect(canTransition("requested", "approved", "captain")).toBe(false);
  });
  it("le Bureau valide, refuse et peut revenir sur sa décision tant que ce n'est pas confirmé", () => {
    expect(nextStatuses("requested", "board")).toEqual(["approved", "rejected", "abandoned"]);
    expect(canTransition("approved", "rejected", "board")).toBe(true);
    expect(canTransition("rejected", "approved", "board")).toBe(true);
    expect(nextStatuses("confirmed", "board")).toEqual([]);
  });
  it("seule la synchro confirme ; un report abandonné est définitif", () => {
    expect(canTransition("approved", "confirmed", "system")).toBe(true);
    expect(canTransition("approved", "confirmed", "board")).toBe(false);
    expect(canTransition("requested", "confirmed", "system")).toBe(false);
    expect(nextStatuses("abandoned", "board")).toEqual([]);
  });
});

describe("isExpired (J-3 de la date demandée)", () => {
  // Créneau demandé : jeudi 26 novembre 2026, 20h Paris.
  const SLOT = "2026-11-26T19:00:00.000Z";
  it("expire à partir du lundi 23 (J-3), heure de Paris", () => {
    expect(isExpired(new Date("2026-11-22T22:59:00Z"), SLOT)).toBe(false); // dim. 23h59 Paris
    expect(isExpired(new Date("2026-11-22T23:00:00Z"), SLOT)).toBe(true); // lun. 0h Paris
  });
  it("respecte le délai réglé (J-1)", () => {
    expect(isExpired(new Date("2026-11-24T12:00:00Z"), SLOT, 1)).toBe(false); // mar.
    expect(isExpired(new Date("2026-11-25T12:00:00Z"), SLOT, 1)).toBe(true); // mer.
  });
});

describe("isConfirmedBySync", () => {
  it("confirme quand le match est à la date du créneau, quelle que soit l'heure", () => {
    expect(isConfirmedBySync("2026-11-26T19:30:00.000Z", "2026-11-26T19:00:00.000Z")).toBe(true);
    expect(isConfirmedBySync("2026-11-24T19:00:00.000Z", "2026-11-26T19:00:00.000Z")).toBe(false);
  });
});
