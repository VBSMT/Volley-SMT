/** Où en est un adhérent avec l'appli (liste du Bureau). Fonction pure. */
export type SetupStatus = "no_account" | "never" | "connected" | "configured";

export const SETUP_LABELS: Record<SetupStatus, string> = {
  no_account: "Sans compte",
  never: "Jamais connecté",
  connected: "Connecté",
  configured: "Configuré",
};

export function setupStatus(m: {
  hasAccount: boolean;
  lastSignInAt: string | null;
  onboardingDoneAt: string | null;
}): SetupStatus {
  if (!m.hasAccount) return "no_account";
  if (m.onboardingDoneAt) return "configured";
  return m.lastSignInAt ? "connected" : "never";
}
