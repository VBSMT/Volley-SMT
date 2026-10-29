import { describe, expect, it } from "vitest";
import { shortName } from "./format";

describe("shortName", () => {
  it("prénom et initiale du nom avec un point", () => {
    expect(shortName("Benjamin", "Recoules")).toBe("Benjamin R.");
    expect(shortName("Élodie", " de la Tour")).toBe("Élodie D.");
    expect(shortName("Max", "")).toBe("Max");
  });
});
