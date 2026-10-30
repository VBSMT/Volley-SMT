import "server-only";

/**
 * Maître du jeu VUT : seul compte autorisé à faire des cadeaux et à utiliser les outils de test
 * (variable VUT_MASTER_EMAIL, jamais écrite dans le code). VUT_TEST_TOOLS=off masque les outils.
 */
export const isGameMaster = (member: { email?: string | null } | null) =>
  !!member?.email && !!process.env.VUT_MASTER_EMAIL && member.email.toLowerCase() === process.env.VUT_MASTER_EMAIL.trim().toLowerCase();

export const testToolsEnabled = () => process.env.VUT_TEST_TOOLS !== "off";
