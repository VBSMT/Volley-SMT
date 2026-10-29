import { describe, expect, it } from "vitest";
import {
  closureMessage,
  isClosureDue,
  isReminderDue,
  parisClock,
  reminderAudience,
  reminderMessage,
} from "./notifications";

// Mardi 3 novembre 2026, 20h Paris = 19h UTC (heure d'hiver).
const TUESDAY_SESSION = "2026-11-03T19:00:00.000Z";

describe("parisClock", () => {
  it("donne l'heure de Paris, été comme hiver", () => {
    expect(parisClock(new Date("2026-11-02T19:00:00Z"))).toEqual({ date: "2026-11-02", hour: 20 });
    expect(parisClock(new Date("2027-06-21T18:00:00Z"))).toEqual({ date: "2027-06-21", hour: 20 });
    expect(parisClock(new Date("2026-11-02T23:30:00Z"))).toEqual({ date: "2026-11-03", hour: 0 });
  });
});

describe("isReminderDue", () => {
  it("envoie la veille à partir de l'heure réglée", () => {
    expect(isReminderDue(new Date("2026-11-02T18:59:00Z"), TUESDAY_SESSION, 20)).toBe(false); // lundi 19h59
    expect(isReminderDue(new Date("2026-11-02T19:00:00Z"), TUESDAY_SESSION, 20)).toBe(true); // lundi 20h
    expect(isReminderDue(new Date("2026-11-02T21:00:00Z"), TUESDAY_SESSION, 20)).toBe(true); // rattrapage 22h
  });
  it("n'envoie ni l'avant-veille ni le jour J", () => {
    expect(isReminderDue(new Date("2026-11-01T19:00:00Z"), TUESDAY_SESSION, 20)).toBe(false);
    expect(isReminderDue(new Date("2026-11-03T08:00:00Z"), TUESDAY_SESSION, 20)).toBe(false);
  });
  it("gère l'heure d'été", () => {
    expect(isReminderDue(new Date("2027-06-21T18:00:00Z"), "2027-06-22T18:00:00.000Z", 20)).toBe(true);
    expect(isReminderDue(new Date("2027-06-21T17:00:00Z"), "2027-06-22T18:00:00.000Z", 20)).toBe(false);
  });
});

describe("isClosureDue", () => {
  it("clôt à 12h heure de Paris le jour J", () => {
    expect(isClosureDue(new Date("2026-11-03T10:59:00Z"), TUESDAY_SESSION)).toBe(false);
    expect(isClosureDue(new Date("2026-11-03T11:00:00Z"), TUESDAY_SESSION)).toBe(true);
  });
});

describe("reminderAudience", () => {
  it("demande aux non-répondants, rappelle aux présents, rien aux absents", () => {
    const answers = new Map([
      ["present", true],
      ["absent", false],
    ]);
    expect(reminderAudience(["present", "absent", "silent"], answers)).toEqual([
      { memberId: "present", kind: "remind" },
      { memberId: "silent", kind: "ask" },
    ]);
  });
});

describe("messages", () => {
  it("formule la demande et le rappel", () => {
    expect(reminderMessage("ask", 0).body).toBe("Tu viens ? Réponds avant 12h demain.");
    expect(reminderMessage("remind", 1).body).toBe("20h–22h · 1 inscrit pour l'instant.");
    expect(reminderMessage("remind", 14).body).toBe("20h–22h · 14 inscrits pour l'instant.");
  });
  it("résume la clôture pour le Bureau", () => {
    expect(closureMessage(13, 2).body).toBe("13 présents, 2 terrains libres.");
  });
});
