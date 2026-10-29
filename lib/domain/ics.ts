/**
 * Flux iCalendar (RFC 5545) des matchs d'une équipe, pour l'abonnement agenda des adhérents
 * (Google Agenda, iPhone, Outlook). Fonction pure.
 */
export type IcsMatch = {
  id: string;
  uid: string | null; // UID volley34 si connu (stable), sinon l'id de l'appli
  startsAt: string; // ISO UTC
  opponent: string;
  isHome: boolean;
  competition: string | null;
  location: string | null;
  url: string;
};

const DURATION_MS = 2 * 3600_000;

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Échappement des valeurs texte (virgule, point-virgule, antislash, retours à la ligne). */
export const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Pliage des lignes à 75 octets (UTF-8), suite précédée d'une espace. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(teamName: string, matches: IcsMatch[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Volley SMT//Matchs//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`Volley SMT · ${teamName}`)}`,
    "X-WR-TIMEZONE:Europe/Paris",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const m of matches) {
    const end = new Date(new Date(m.startsAt).getTime() + DURATION_MS).toISOString();
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(m.uid ?? m.id)}@volley-smt`,
      `DTSTAMP:${stamp(now.toISOString())}`,
      `DTSTART:${stamp(m.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escapeText(`🏐 ${teamName} – ${m.opponent} (${m.isHome ? "domicile" : "extérieur"})`)}`,
      ...(m.location ? [`LOCATION:${escapeText(m.location)}`] : []),
      ...(m.competition ? [`DESCRIPTION:${escapeText(`${m.competition}\n${m.url}`)}`] : [`DESCRIPTION:${escapeText(m.url)}`]),
      `URL:${m.url}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
