import { parisDate, pollDeadline } from "./training";

export type ReminderKind = "ask" | "remind";

export type Message = { title: string; body: string; url: string };

/** Heure (0–23) et date (AAAA-MM-JJ) de Paris d'un instant. */
export function parisClock(at: Date): { date: string; hour: number } {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(at),
  );
  return { date: parisDate(at.toISOString()), hour };
}

const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Notification J-1 due : la séance a lieu demain (heure de Paris) et l'heure d'envoi est passée.
 * « Passée » plutôt qu'« égale » : un appel horaire manqué est rattrapé (le journal évite les doublons).
 */
export function isReminderDue(now: Date, sessionStartsAt: string, sendHour: number): boolean {
  const { date, hour } = parisClock(now);
  return nextDay(date) === parisDate(sessionStartsAt) && hour >= sendHour;
}

/** Clôture due : 12h (Paris) le jour J est passé. */
export function isClosureDue(now: Date, sessionStartsAt: string): boolean {
  return now.getTime() >= pollDeadline(sessionStartsAt).getTime();
}

/**
 * Destinataires de la notification J-1 :
 * non-répondants → demande ; présents → rappel ; « je ne viens pas » → rien.
 */
export function reminderAudience(
  memberIds: string[],
  answers: Map<string, boolean>,
): { memberId: string; kind: ReminderKind }[] {
  return memberIds.flatMap((memberId): { memberId: string; kind: ReminderKind }[] => {
    const answer = answers.get(memberId);
    if (answer === undefined) return [{ memberId, kind: "ask" }];
    if (answer) return [{ memberId, kind: "remind" }];
    return [];
  });
}

export function reminderMessage(kind: ReminderKind, presentCount: number): Message {
  if (kind === "ask") {
    return {
      title: "🏐 Entraînement demain 20h–22h",
      body: "Tu viens ? Réponds avant 12h demain.",
      url: "/entrainements",
    };
  }
  return {
    title: "🏐 N'oublie pas : entraînement demain",
    body: `20h–22h · ${presentCount} inscrit${presentCount > 1 ? "s" : ""} pour l'instant.`,
    url: "/entrainements",
  };
}

export function closureMessage(presentCount: number, freeCourts: number, warnings = 0): Message {
  const alert = warnings ? ` ${warnings} point${warnings > 1 ? "s" : ""} d'attention.` : "";
  return {
    title: "Compo prête pour ce soir",
    body: `${presentCount} présent${presentCount > 1 ? "s" : ""}, ${freeCourts} terrain${freeCourts > 1 ? "s" : ""}.${alert}`,
    url: "/bureau/compo",
  };
}

// --- Matchs (J-2) -------------------------------------------------------------

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Rappel de match dû : le match a lieu dans 2 jours (Paris) et l'heure d'envoi est passée. */
export function isMatchReminderDue(now: Date, matchStartsAt: string, sendHour: number): boolean {
  const { date, hour } = parisClock(now);
  return addDays(date, 2) === parisDate(matchStartsAt) && hour >= sendHour;
}

const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", ...options });

export function matchMessage(match: {
  startsAt: string;
  teamName: string;
  opponent: string;
  isHome: boolean;
  venue: string | null;
  city: string | null;
}): Message {
  const when = `${fmt(match.startsAt, { weekday: "long" })} ${fmt(match.startsAt, { hour: "2-digit", minute: "2-digit" })}`;
  const where = match.isHome
    ? "À domicile."
    : `À l'extérieur${[match.venue, match.city].some(Boolean) ? ` : ${[match.venue, match.city].filter(Boolean).join(", ")}` : ""}.`;
  return {
    title: `🏐 Match ${when} · ${match.teamName}`,
    body: `Contre ${match.opponent}. ${where}`,
    url: "/matchs",
  };
}

// --- Renforts -----------------------------------------------------------------

export type Sex = "F" | "M";
export type Position = "setter" | "front" | "back";

const POSITIONS: Record<Position, string> = { setter: "passeur·se", front: "avant", back: "fond" };

/** Destinataires d'une demande de renfort : hors équipe, sexe demandé, préférence activée. */
export function reinforcementAudience<
  M extends { id: string; sex: Sex; team_ids: string[]; notify_reinforcement: boolean },
>(members: M[], request: { teamId: string; sex: Sex | null; captainId: string | null }): M[] {
  return members.filter(
    (m) =>
      m.notify_reinforcement &&
      !m.team_ids.includes(request.teamId) &&
      m.id !== request.captainId &&
      (request.sex === null || m.sex === request.sex),
  );
}

/** Profil recherché, ex. « une joueuse au poste de passeur·se ». */
export function wantedLabel(sex: Sex | null, position: Position | null): string {
  const who = sex === "F" ? "une joueuse" : sex === "M" ? "un joueur" : "un·e joueur·se";
  if (!position) return who;
  return `${who} au poste ${position === "front" ? "d'" : "de "}${POSITIONS[position]}`;
}

export function reinforcementMessage(request: {
  teamName: string;
  matchStartsAt: string;
  sex: Sex | null;
  position: Position | null;
}): Message {
  const when = `${fmt(request.matchStartsAt, { weekday: "long", day: "numeric", month: "long" })} à ${fmt(request.matchStartsAt, { hour: "2-digit", minute: "2-digit" })}`;
  return {
    title: `🙋 Renfort recherché · ${request.teamName}`,
    body: `${wantedLabel(request.sex, request.position).replace(/^./, (c) => c.toUpperCase())} pour le match du ${when}. Tu peux aider ?`,
    url: "/accueil",
  };
}

export function offerMessage(volunteerName: string, teamName: string): Message {
  return {
    title: "🙋 Proposition de renfort",
    body: `${volunteerName} propose son aide à ${teamName}.`,
    url: "/accueil",
  };
}

// --- Sondage de présence d'un match -----------------------------------------

export function matchPollMessage(match: { id: string; startsAt: string; teamName: string; opponent: string }): Message {
  const when = `${fmt(match.startsAt, { weekday: "long", day: "numeric", month: "long" })} à ${fmt(match.startsAt, { hour: "2-digit", minute: "2-digit" })}`;
  return {
    title: `📋 ${match.teamName} : es-tu dispo ?`,
    body: `Match du ${when} contre ${match.opponent}. Réponds dans l'appli.`,
    url: `/matchs/${match.id}`,
  };
}

// --- Reports de match ----------------------------------------------------------

export type RescheduleInfo = {
  matchId: string;
  teamName: string;
  opponent: string;
  matchStartsAt: string;
  slotStartsAt: string;
};

const day = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long" });

/** Au Bureau : nouvelle demande de report. */
export function rescheduleRequestedMessage(r: RescheduleInfo): Message {
  return {
    title: `📅 Demande de report · ${r.teamName}`,
    body: `Match contre ${r.opponent} du ${day(r.matchStartsAt)} → créneau du ${day(r.slotStartsAt)} demandé.`,
    url: "/bureau/reports",
  };
}

/** Aux capitaines : décision du Bureau, expiration ou confirmation. */
export function rescheduleDecisionMessage(
  r: RescheduleInfo,
  status: "approved" | "rejected" | "abandoned" | "confirmed",
  reason?: "expired",
): Message {
  const slot = day(r.slotStartsAt);
  const body = {
    approved: `Créneau du ${slot} pré-réservé pour le match contre ${r.opponent}. À faire valider par l'adversaire et volley34.`,
    rejected: `Le Bureau n'a pas retenu le créneau du ${slot} pour le match contre ${r.opponent}.`,
    abandoned:
      reason === "expired"
        ? `Report non confirmé à J-3 : le créneau du ${slot} est libéré (match contre ${r.opponent}).`
        : `Report du match contre ${r.opponent} abandonné : le créneau du ${slot} est libéré.`,
    confirmed: `volley34 confirme le match contre ${r.opponent} le ${slot}.`,
  }[status];
  const title = {
    approved: "✅ Report : créneau pré-réservé",
    rejected: "❌ Report refusé",
    abandoned: "Report abandonné",
    confirmed: "✅ Report confirmé",
  }[status];
  return { title: `${title} · ${r.teamName}`, body, url: `/matchs/${r.matchId}` };
}
