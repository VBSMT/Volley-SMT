/**
 * Synchronisation avec volley34.fr (accord de la commission) : lecture du flux ICS
 * d'une équipe et rapprochement avec les matchs déjà enregistrés. Fonctions pures.
 */

export type IcsEvent = { uid: string; startsAt: string; location: string; summary: string };

export type Volley34Match = {
  uid: string;
  startsAt: string;
  isHome: boolean;
  opponent: string;
  venue: string | null;
  city: string | null;
};

export type ExistingMatch = {
  id: string;
  opponent: string;
  is_home: boolean;
  starts_at: string;
  volley34_ref: string | null;
};

export type Volley34Team = { code: string; name: string; clubCode: string };

const unescape = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

/** « 20261103T190000Z » → ISO. */
function icsDate(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value.trim());
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString() : null;
}

/** Lit les VEVENT d'un flux ICS (lignes repliées gérées, alarmes ignorées). */
export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const events: IcsEvent[] = [];
  let current: Record<string, string> | null = null;
  let depth = 0; // composants imbriqués (VALARM) à ignorer

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      depth = 0;
    } else if (current && line.startsWith("BEGIN:")) depth++;
    else if (current && line.startsWith("END:") && line !== "END:VEVENT") depth--;
    else if (line === "END:VEVENT" && current) {
      const startsAt = icsDate(current.DTSTART ?? "");
      if (current.UID && startsAt) {
        events.push({
          uid: current.UID.replace(/@.*$/, ""),
          startsAt,
          location: unescape(current.LOCATION ?? ""),
          summary: unescape(current.SUMMARY ?? ""),
        });
      }
      current = null;
    } else if (current && depth === 0) {
      const i = line.indexOf(":");
      if (i > 0) current[line.slice(0, i).split(";")[0]] = line.slice(i + 1);
    }
  }
  return events;
}

/** « Salle Polyvalente (Vailhauquès) » → salle + ville. */
export function splitLocation(location: string): { venue: string | null; city: string | null } {
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(location);
  if (!m) return { venue: location || null, city: null };
  return { venue: m[1].replace(/\s+/g, " ").trim() || null, city: m[2].replace(/\s+/g, " ").trim() };
}

/** Matchs de l'équipe à partir de son flux (« X reçoit Y »). */
export function teamMatches(events: IcsEvent[], teamFullName: string): Volley34Match[] {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  return events.flatMap((e) => {
    const [home, away] = e.summary.split(/\s+reçoit\s+/i);
    if (!home || !away) return [];
    const isHome = norm(home) === norm(teamFullName);
    if (!isHome && norm(away) !== norm(teamFullName)) return [];
    return [{ uid: e.uid, startsAt: e.startsAt, isHome, opponent: (isHome ? away : home).trim(), ...splitLocation(e.location) }];
  });
}

/**
 * Rapproche les matchs volley34 des matchs enregistrés : d'abord par UID,
 * sinon par adversaire + domicile/extérieur (un seul match aller et un retour par adversaire).
 * volley34 fait foi pour la date et le lieu. Rien n'est jamais supprimé.
 */
export function reconcile(remote: Volley34Match[], existing: ExistingMatch[]) {
  const updates: { id: string; match: Volley34Match; moved: boolean }[] = [];
  const inserts: Volley34Match[] = [];
  const free = new Map(existing.map((e) => [e.id, e]));
  const key = (opponent: string, isHome: boolean) => `${opponent.trim().toLowerCase()}|${isHome}`;

  for (const r of remote) {
    let found = existing.find((e) => e.volley34_ref === r.uid && free.has(e.id));
    if (!found) {
      const candidates = [...free.values()].filter(
        (e) => !e.volley34_ref && key(e.opponent, e.is_home) === key(r.opponent, r.isHome),
      );
      // Plusieurs candidats (ex. coupe + championnat) : le plus proche en date.
      found = candidates.sort(
        (a, b) =>
          Math.abs(Date.parse(a.starts_at) - Date.parse(r.startsAt)) -
          Math.abs(Date.parse(b.starts_at) - Date.parse(r.startsAt)),
      )[0];
    }
    if (found) {
      free.delete(found.id);
      updates.push({ id: found.id, match: r, moved: Date.parse(found.starts_at) !== Date.parse(r.startsAt) });
    } else inserts.push(r);
  }
  return { updates, inserts };
}

/**
 * Équipes d'un club dans la réponse de l'API volley34 (/v1/equipes).
 * L'API répond en XML ou en JSON selon l'en-tête Accept : les deux sont gérés.
 */
export function parseTeams(body: string, clubCode: string): Volley34Team[] {
  const text = body.trim();
  if (text.startsWith("[") || text.startsWith("{")) {
    const data = JSON.parse(text) as unknown;
    const list = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
    return list
      .map((t) => ({
        code: String(t.EquipeCode ?? t.equipeCode ?? ""),
        name: String(t.NomEquipe ?? t.nomEquipe ?? ""),
        clubCode: String(t.ClubCode ?? t.clubCode ?? ""),
      }))
      .filter((t) => t.code && t.clubCode === clubCode);
  }
  return parseTeamsXml(text, clubCode);
}

function parseTeamsXml(xml: string, clubCode: string): Volley34Team[] {
  const decode = (s: string) =>
    s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const tag = (block: string, name: string) => decode(new RegExp(`<${name}>([^<]*)</${name}>`).exec(block)?.[1] ?? "");
  return [...xml.matchAll(/<Equipe>([\s\S]*?)<\/Equipe>/g)]
    .map((m) => ({ code: tag(m[1], "EquipeCode"), name: tag(m[1], "NomEquipe"), clubCode: tag(m[1], "ClubCode") }))
    .filter((t) => t.code && t.clubCode === clubCode);
}

/** Page volley34 de saisie d'un résultat ou d'un report (championnat ou coupe). */
export function volley34EntryUrl(competition: string | null): string {
  const cup = /coupe/i.test(competition ?? "");
  return `https://www.volley34.fr/Pages/SaisieResultat.aspx?C=${cup ? "CO" : "CH"}`;
}
