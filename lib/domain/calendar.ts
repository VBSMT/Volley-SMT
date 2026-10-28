/**
 * Calendrier officiel utilisé pour fermer les créneaux par défaut.
 * Source vacances : data.education.gouv.fr (fr-en-calendrier-scolaire), zone C, Montpellier.
 * Dates inclusives : premier et dernier jour sans école.
 */
export const SCHOOL_HOLIDAYS: { label: string; from: string; to: string }[] = [
  { label: "Vacances de la Toussaint", from: "2026-10-17", to: "2026-11-01" },
  { label: "Vacances de Noël", from: "2026-12-19", to: "2027-01-03" },
  { label: "Vacances d'hiver", from: "2027-02-06", to: "2027-02-21" },
  { label: "Vacances de printemps", from: "2027-04-03", to: "2027-04-18" },
  { label: "Pont de l'Ascension", from: "2027-05-07", to: "2027-05-07" },
  { label: "Vacances d'été", from: "2027-07-03", to: "2027-08-31" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher), en UTC. */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Jours fériés en France métropolitaine, indexés par date « AAAA-MM-JJ ». */
export function publicHolidays(year: number): Map<string, string> {
  const e = easter(year);
  return new Map([
    [`${year}-01-01`, "Jour de l'an"],
    [ymd(addDays(e, 1)), "Lundi de Pâques"],
    [`${year}-05-01`, "Fête du travail"],
    [`${year}-05-08`, "Victoire 1945"],
    [ymd(addDays(e, 39)), "Ascension"],
    [ymd(addDays(e, 50)), "Lundi de Pentecôte"],
    [`${year}-07-14`, "Fête nationale"],
    [`${year}-08-15`, "Assomption"],
    [`${year}-11-01`, "Toussaint"],
    [`${year}-11-11`, "Armistice"],
    [`${year}-12-25`, "Noël"],
  ]);
}

/** Raison de fermeture par défaut d'une date (vacances ou jour férié), sinon null. */
export function closureReason(date: string): string | null {
  const holiday = publicHolidays(Number(date.slice(0, 4))).get(date);
  if (holiday) return `Férié (${holiday})`;
  return SCHOOL_HOLIDAYS.find((h) => h.from <= date && date <= h.to)?.label ?? null;
}
