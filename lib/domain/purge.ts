/** Règles de conservation RGPD (dates au format AAAA-MM-JJ, heure de Paris). */

/** Date limite : une fiche dont la dernière adhésion s'est terminée avant cette date est supprimée (2 ans). */
export function memberPurgeCutoff(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const cutoff = new Date(Date.UTC(y - 2, m - 1, d));
  // 29 février → 28 février (Date.UTC le décalerait au 1er mars).
  if (cutoff.getUTCMonth() !== m - 1) cutoff.setUTCDate(0);
  return cutoff.toISOString().slice(0, 10);
}

/** Fiche à supprimer : dernière adhésion terminée depuis plus de 2 ans. */
export function shouldPurgeMember(lastMembershipEndsOn: string | null, today: string): boolean {
  return !!lastMembershipEndsOn && lastMembershipEndsOn < memberPurgeCutoff(today);
}

/** Niveau à supprimer : adhésion terminée (fin strictement passée). */
export function shouldPurgeLevel(lastMembershipEndsOn: string | null, today: string): boolean {
  return !!lastMembershipEndsOn && lastMembershipEndsOn < today;
}
