import { describe, expect, it } from "vitest";
import { setupStatus } from "./setup-status";

describe("statut d'installation d'un adhérent", () => {
  it("du compte absent à la configuration terminée", () => {
    expect(setupStatus({ hasAccount: false, lastSignInAt: null, onboardingDoneAt: null })).toBe("no_account");
    expect(setupStatus({ hasAccount: true, lastSignInAt: null, onboardingDoneAt: null })).toBe("never");
    expect(setupStatus({ hasAccount: true, lastSignInAt: "2026-10-30T10:00:00Z", onboardingDoneAt: null })).toBe("connected");
    expect(setupStatus({ hasAccount: true, lastSignInAt: "2026-10-30T10:00:00Z", onboardingDoneAt: "2026-10-30T10:05:00Z" })).toBe("configured");
  });
});
