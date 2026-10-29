/**
 * Événements (CLAUDE.md, « Événements ») : visibilité par rôle et totaux des sondages.
 * Fonctions pures, miroir des règles appliquées en base (RLS).
 */

export type Role = "member" | "captain" | "volunteer" | "board";
export type EventType = "tournament" | "town_event" | "members_meal" | "other";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  tournament: "Tournoi",
  town_event: "Événement de la ville",
  members_meal: "Repas des adhérents",
  other: "Autre",
};

/** Rôles proposés pour restreindre la visibilité (vide = tous les adhérents). */
export const VISIBILITY_ROLES: { role: Role; label: string }[] = [
  { role: "captain", label: "Capitaines" },
  { role: "volunteer", label: "Bénévoles" },
  { role: "board", label: "Bureau" },
];

/** Une personne voit l'événement si elle a au moins un des rôles choisis ; le Bureau voit tout. */
export function canSeeEvent(visibleRoles: Role[], memberRoles: Role[]): boolean {
  if (memberRoles.includes("board") || visibleRoles.length === 0) return true;
  return visibleRoles.some((r) => memberRoles.includes(r));
}

export function visibilityLabel(visibleRoles: Role[]): string {
  if (!visibleRoles.length) return "Tous les adhérents";
  return VISIBILITY_ROLES.filter((v) => visibleRoles.includes(v.role)).map((v) => v.label).join(", ");
}

export type AttendanceAnswer = {
  coming: boolean;
  with_partner: boolean | null;
  children: number | null;
  guests: number | null;
};

/** Suivi du sondage de présence : adhérents, conjoint·es, enfants, invités et total de personnes. */
export function attendanceTotals(answers: AttendanceAnswer[]) {
  const coming = answers.filter((a) => a.coming);
  const members = coming.length;
  const partners = coming.filter((a) => a.with_partner).length;
  const children = coming.reduce((s, a) => s + (a.children ?? 0), 0);
  const guests = coming.reduce((s, a) => s + (a.guests ?? 0), 0);
  return { members, partners, children, guests, total: members + partners + children + guests, notComing: answers.length - members };
}

/** Couverture des besoins bénévoles par poste (ex. buvette 2/4). */
export function volunteerCoverage(
  needs: { id: string; label: string; needed: number }[],
  signups: { available: boolean; need_id: string | null }[],
) {
  return needs.map((n) => {
    const filled = signups.filter((s) => s.available && s.need_id === n.id).length;
    return { ...n, filled, missing: Math.max(0, n.needed - filled) };
  });
}
