import { closureReason } from "./calendar";
import { parisWallTimeToUtc } from "./paris-time";

export const COURTS = 3;
const TRAINING_DAYS = [2, 4]; // mardi, jeudi
const START_HOUR = 20;
const END_HOUR = 22;
const POLL_CLOSE_HOUR = 12;

export type GeneratedSession = {
  date: string; // AAAA-MM-JJ (heure de Paris)
  startsAt: string; // ISO UTC
  endsAt: string;
  isClosedDay: boolean;
  openCourts: number;
};

const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const parts = (d: Date) => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()] as const;

/**
 * Séances de la saison : tous les mardis et jeudis 20h–22h, bornes incluses.
 * Vacances scolaires (zone C) et jours fériés : 0 terrain par défaut.
 */
export function generateSessions(from: string, to: string): GeneratedSession[] {
  const sessions: GeneratedSession[] = [];
  for (let d = toDate(from); d <= toDate(to); d = new Date(d.getTime() + 86_400_000)) {
    if (!TRAINING_DAYS.includes(d.getUTCDay())) continue;
    const date = d.toISOString().slice(0, 10);
    const closed = closureReason(date) !== null;
    sessions.push({
      date,
      startsAt: parisWallTimeToUtc(...parts(d), START_HOUR, 0).toISOString(),
      endsAt: parisWallTimeToUtc(...parts(d), END_HOUR, 0).toISOString(),
      isClosedDay: closed,
      openCourts: closed ? 0 : COURTS,
    });
  }
  return sessions;
}

/** Date (AAAA-MM-JJ) à Paris d'un instant. */
export function parisDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
}

/** Clôture du sondage : 12h (heure de Paris) le jour de la séance. */
export function pollDeadline(sessionStartsAt: string): Date {
  const [y, m, d] = parisDate(sessionStartsAt).split("-").map(Number);
  return parisWallTimeToUtc(y, m, d, POLL_CLOSE_HOUR, 0);
}

/** Terrains libres = terrains ouverts − matchs à domicile − pré-réservations de report validées. */
export function freeCourts(openCourts: number, homeMatches: number, approvedReschedules: number): number {
  return Math.max(0, openCourts - homeMatches - approvedReschedules);
}
