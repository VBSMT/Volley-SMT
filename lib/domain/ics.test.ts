import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "./ics";

describe("flux iCalendar des matchs", () => {
  const ics = buildIcs(
    "Les Bras Cassés",
    [
      {
        id: "m1",
        uid: "2027-CE03377",
        startsAt: "2026-11-12T19:45:00.000Z",
        opponent: "VCV/les volleyrieurs",
        isHome: false,
        competition: "4x4 Mixte, Niveau 2",
        location: "Salle Polyvalente, Vailhauquès",
        url: "https://volley-smt.vercel.app/matchs/m1",
      },
    ],
    new Date("2026-10-29T12:00:00Z"),
  );

  it("produit un VEVENT valide en UTC", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:2027-CE03377@volley-smt");
    expect(ics).toContain("DTSTART:20261112T194500Z");
    expect(ics).toContain("DTEND:20261112T214500Z");
    expect(ics).toContain("LOCATION:Salle Polyvalente\\, Vailhauquès");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("plie les lignes longues à 75 octets", () => {
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(foldLine("a".repeat(80))).toBe(`${"a".repeat(75)}\r\n ${"a".repeat(5)}`);
  });

  it("échappe les caractères spéciaux", () => {
    expect(escapeText("a,b;c\nd")).toBe("a\\,b\;c\\nd");
  });
});
