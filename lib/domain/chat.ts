/**
 * Messagerie éphémère : salons, adresses et mentions. Fonctions pures.
 */
export type RoomKey = string; // 'club' | 'board' | 'captains' | 'volunteers' | 'team:<uuid>'

export const CHAT_RETENTION_DAYS = 7;

/** Clé de salon ↔ segment d'adresse (/chat/club, /chat/bureau, /chat/capitaines, /chat/equipe-<uuid>). */
export function roomToSlug(room: RoomKey): string {
  if (room === "board") return "bureau";
  if (room === "captains") return "capitaines";
  if (room === "volunteers") return "benevoles";
  if (room.startsWith("team:")) return `equipe-${room.slice(5)}`;
  return "club";
}

export function slugToRoom(slug: string): RoomKey | null {
  if (slug === "club") return "club";
  if (slug === "bureau") return "board";
  if (slug === "capitaines") return "captains";
  if (slug === "benevoles") return "volunteers";
  const m = /^equipe-([0-9a-f-]{36})$/.exec(slug);
  return m ? `team:${m[1]}` : null;
}

/** Personnes citées dans un message (« @Benjamin R. »), parmi les noms affichés du salon. */
export function mentionedIds(body: string, people: { id: string; name: string }[]): string[] {
  const text = body.toLocaleLowerCase("fr");
  return people.filter((p) => p.name && text.includes(`@${p.name.toLocaleLowerCase("fr")}`)).map((p) => p.id);
}
