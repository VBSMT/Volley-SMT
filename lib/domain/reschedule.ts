/**
 * Reports de match (CLAUDE.md, « Reports ») : le Bureau ne gère que la partie gymnase.
 * Fonctions pures : transitions autorisées, expiration à J-3, confirmation par la synchro.
 */
import { parisDate } from "./training";

export type RescheduleStatus = "requested" | "approved" | "rejected" | "confirmed" | "abandoned";
export type Actor = "captain" | "board" | "system";

/** Statuts « actifs » : une seule demande active par match. */
export const ACTIVE: RescheduleStatus[] = ["requested", "approved"];

const TRANSITIONS: Record<RescheduleStatus, Partial<Record<RescheduleStatus, Actor[]>>> = {
  requested: { approved: ["board"], rejected: ["board"], abandoned: ["captain", "board", "system"] },
  // Le Bureau peut revenir sur une validation tant que le report n'est pas confirmé.
  approved: { rejected: ["board"], abandoned: ["captain", "board", "system"], confirmed: ["system"] },
  rejected: { approved: ["board"] },
  confirmed: {},
  abandoned: {},
};

export function canTransition(from: RescheduleStatus, to: RescheduleStatus, actor: Actor): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}

/** Transitions proposées à un acteur depuis un statut (pour l'affichage des boutons). */
export function nextStatuses(from: RescheduleStatus, actor: Actor): RescheduleStatus[] {
  return (Object.keys(TRANSITIONS[from]) as RescheduleStatus[]).filter((to) => canTransition(from, to, actor));
}

const DAY = 86_400_000;

/** Expiration automatique : à J-n (3 par défaut) de la date demandée (heure de Paris), si pas encore confirmé. */
export function isExpired(now: Date, requestedSessionStartsAt: string, days = 3): boolean {
  const target = new Date(`${parisDate(requestedSessionStartsAt)}T12:00:00Z`).getTime();
  const today = new Date(`${parisDate(now.toISOString())}T12:00:00Z`).getTime();
  return today >= target - days * DAY;
}

/** Confirmation : la synchro volley34 voit le match à la date demandée. */
export function isConfirmedBySync(matchStartsAt: string, requestedSessionStartsAt: string): boolean {
  return parisDate(matchStartsAt) === parisDate(requestedSessionStartsAt);
}

export const STATUS_LABELS: Record<RescheduleStatus, string> = {
  requested: "En attente du Bureau",
  approved: "Créneau pré-réservé",
  rejected: "Refusé",
  confirmed: "Confirmé par volley34",
  abandoned: "Abandonné",
};
