import { describe, expect, it } from "vitest";
import { mentionedIds, roomToSlug, slugToRoom } from "./chat";

describe("messagerie", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  it("convertit salons et adresses", () => {
    for (const room of ["club", "board", "captains", `team:${id}`]) expect(slugToRoom(roomToSlug(room))).toBe(room);
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
