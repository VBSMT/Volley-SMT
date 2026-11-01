import "server-only";

/**
 * Maître du jeu VUT : seul compte autorisé à faire des cadeaux
 * (variable VUT_MASTER_EMAIL, jamais écrite dans le code).
 */
export const isGameMaster = (member: { email?: string | null } | null) =>
  !!member?.email && !!process.env.VUT_MASTER_EMAIL && member.email.toLowerCase() === process.env.VUT_MASTER_EMAIL.trim().toLowerCase();

