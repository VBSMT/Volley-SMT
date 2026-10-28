import { describe, expect, it } from "vitest";
import { closureReason, publicHolidays } from "./calendar";
import { freeCourts, generateSessions, parisDate, pollDeadline } from "./training";

describe("publicHolidays", () => {
  it("calcule les fêtes mobiles 2027 (Pâques le 28 mars)", () => {
    const h = publicHolidays(2027);
    expect(h.get("2027-03-29")).toBe("Lundi de Pâques");
    expect(h.get("2027-05-06")).toBe("Ascension");
    expect(h.get("2027-05-17")).toBe("Lundi de Pentecôte");
  });
});

describe("closureReason", () => {
  it("ferme pendant les vacances, bornes incluses", () => {
    expect(closureReason("2026-10-17")).toBe("Vacances de la Toussaint");
    expect(closureReason("2026-11-01")).toBe("Férié (Toussaint)");
    expect(closureReason("2027-02-21")).toBe("Vacances d'hiver");
  });
  it("laisse ouverts les jours normaux", () => {
    expect(closureReason("2026-11-03")).toBeNull();
    expect(closureReason("2027-02-22")).toBeNull();
  });
});

describe("generateSessions", () => {
  const sessions = generateSessions("2026-09-08", "2027-06-24");

  it("crée tous les mardis et jeudis, bornes incluses", () => {
    expect(sessions[0].date).toBe("2026-09-08");
    expect(sessions.at(-1)!.date).toBe("2027-06-24");
    const days = new Set(sessions.map((s) => new Date(`${s.date}T12:00:00Z`).getUTCDay()));
    expect([...days].sort()).toEqual([2, 4]);
    expect(sessions).toHaveLength(84);
  });

  it("place les séances à 20h–22h heure de Paris (été comme hiver)", () => {
    expect(sessions[0]).toMatchObject({ startsAt: "2026-09-08T18:00:00.000Z", endsAt: "2026-09-08T20:00:00.000Z" });
    const dec = sessions.find((s) => s.date === "2026-12-01")!;
    expect(dec.startsAt).toBe("2026-12-01T19:00:00.000Z");
  });

  it("met 0 terrain pendant les vacances et les jours fériés, 3 sinon", () => {
    const byDate = new Map(sessions.map((s) => [s.date, s]));
    expect(byDate.get("2026-10-20")).toMatchObject({ isClosedDay: true, openCourts: 0 });
    expect(byDate.get("2027-05-06")).toMatchObject({ isClosedDay: true, openCourts: 0 }); // Ascension
    expect(byDate.get("2026-11-03")).toMatchObject({ isClosedDay: false, openCourts: 3 });
  });
});

describe("pollDeadline", () => {
  it("clôt à 12h heure de Paris le jour J", () => {
    expect(pollDeadline("2026-11-03T19:00:00.000Z").toISOString()).toBe("2026-11-03T11:00:00.000Z");
    expect(pollDeadline("2027-06-24T18:00:00.000Z").toISOString()).toBe("2027-06-24T10:00:00.000Z");
  });
});

describe("parisDate", () => {
  it("donne la date locale de Paris", () => {
    expect(parisDate("2026-11-03T23:30:00.000Z")).toBe("2026-11-04");
  });
});

describe("freeCourts", () => {
  it("retire matchs à domicile et reports validés", () => {
    expect(freeCourts(3, 0, 0)).toBe(3);
    expect(freeCourts(3, 2, 0)).toBe(1);
    expect(freeCourts(3, 2, 1)).toBe(0);
  });
  it("ne descend jamais sous 0", () => {
    expect(freeCourts(3, 3, 1)).toBe(0);
    expect(freeCourts(0, 1, 0)).toBe(0);
  });
});
