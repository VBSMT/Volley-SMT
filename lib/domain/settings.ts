/**
 * Réglages horaires (Bureau > Paramètres), stockés dans app_settings. Fonction pure de lecture.
 */
export type Schedule = {
  reminderHour: number; // notification J-1 (et rappel de match J-2), heure de Paris
  closeHour: number; // clôture du sondage le jour J, heure de Paris
  expiryDays: number; // expiration automatique des reports, en jours avant la date demandée
};

export const DEFAULT_SCHEDULE: Schedule = { reminderHour: 20, closeHour: 12, expiryDays: 3 };

export const LIMITS = {
  reminderHour: { min: 16, max: 22 },
  closeHour: { min: 6, max: 18 },
  expiryDays: { min: 1, max: 7 },
} as const;

const hourOf = (v: unknown): number | null => {
  const text = typeof v === "string" ? v : typeof v === "object" && v && "time" in v ? String((v as { time: unknown }).time) : "";
  const m = /^(\d{1,2})(?::\d{2})?$/.exec(text.trim());
  return m ? Number(m[1]) : null;
};

const within = (n: number | null, key: keyof typeof LIMITS) =>
  n !== null && Number.isInteger(n) && n >= LIMITS[key].min && n <= LIMITS[key].max ? n : DEFAULT_SCHEDULE[key];

/** Lit les lignes { key, value } d'app_settings ; toute valeur absente ou invalide prend la valeur par défaut. */
export function parseSchedule(rows: { key: string; value: unknown }[]): Schedule {
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  return {
    reminderHour: within(hourOf(get("poll_reminder")), "reminderHour"),
    closeHour: within(hourOf(get("poll_close_time")), "closeHour"),
    expiryDays: within(Number(get("reschedule_expiry_days")), "expiryDays"),
  };
}

/** Valeurs à enregistrer dans app_settings. */
export function scheduleToSettings(s: Schedule) {
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return [
    { key: "poll_reminder", value: { days_before: 1, time: hh(s.reminderHour) } },
    { key: "poll_close_time", value: hh(s.closeHour) },
    { key: "reschedule_expiry_days", value: s.expiryDays },
  ];
}
