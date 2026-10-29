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

export function closureMessage(presentCount: number, freeCourts: number): Message {
  return {
    title: "Sondage clos pour ce soir",
    body: `${presentCount} présent${presentCount > 1 ? "s" : ""}, ${freeCourts} terrain${freeCourts > 1 ? "s" : ""} libre${freeCourts > 1 ? "s" : ""}.`,
    url: "/entrainements",
  };
}
