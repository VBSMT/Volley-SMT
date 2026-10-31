import { describe, expect, it } from "vitest";
import { mentionedIds, reactionSummary, roomToSlug, slugToRoom } from "./chat";

describe("messagerie", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  it("convertit salons et adresses", () => {
    for (const room of ["club", "board", "captains", "volunteers", `team:${id}`]) expect(slugToRoom(roomToSlug(room))).toBe(room);
    expect(slugToRoom("inconnu")).toBeNull();
    expect(slugToRoom("equipe-pas-un-id")).toBeNull();
  });
  it("repère les mentions", () => {
    const people = [
      { id: "1", name: "Benjamin R." },
      { id: "2", name: "Alice M." },
    ];
    expect(mentionedIds("Salut @Benjamin R. et @alice m. !", people)).toEqual(["1", "2"]);
    expect(mentionedIds("Benjamin R. sans arobase", people)).toEqual([]);
  });
});

describe("réactions", () => {
  it("pastilles par emoji, dans l'ordre fixe, avec la sienne repérée", () => {
    const rows = [
      { messageId: "m", memberId: "a", emoji: "😂" as const },
      { messageId: "m", memberId: "b", emoji: "👍" as const },
      { messageId: "m", memberId: "a", emoji: "👍" as const },
      { messageId: "x", memberId: "a", emoji: "❤️" as const },
    ];
    expect(reactionSummary(rows, "m", "a")).toEqual([
      { emoji: "👍", count: 2, mine: true, who: ["b", "a"] },
      { emoji: "😂", count: 1, mine: true, who: ["a"] },
    ]);
  });
});

describe("salon VUT", () => {
  it("adresse /chat/vut", () => {
    expect(roomToSlug("vut")).toBe("vut");
    expect(slugToRoom("vut")).toBe("vut");
  });
});
