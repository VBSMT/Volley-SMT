import { describe, expect, it } from "vitest";
import { memberPurgeCutoff, shouldPurgeLevel, shouldPurgeMember } from "./purge";

describe("purge RGPD", () => {
  it("calcule la limite à 2 ans", () => {
    expect(memberPurgeCutoff("2026-10-29")).toBe("2024-10-29");
    expect(memberPurgeCutoff("2028-02-29")).toBe("2026-02-28");
  });
  it("supprime la fiche 2 ans après la dernière adhésion", () => {
    expect(shouldPurgeMember("2024-06-24", "2026-10-29")).toBe(true);
    expect(shouldPurgeMember("2025-06-24", "2026-10-29")).toBe(false);
    expect(shouldPurgeMember("2024-10-29", "2026-10-29")).toBe(false);
    expect(shouldPurgeMember(null, "2026-10-29")).toBe(false);
  });
  it("supprime le niveau dès la fin de l'adhésion", () => {
    expect(shouldPurgeLevel("2026-06-24", "2026-10-29")).toBe(true);
    expect(shouldPurgeLevel("2026-10-29", "2026-10-29")).toBe(false);
    expect(shouldPurgeLevel(null, "2026-10-29")).toBe(false);
  });
});
