/**
 * Messagerie éphémère : salons, adresses et mentions. Fonctions pures.
 */
export type RoomKey = string; // 'club' | 'vut' | 'board' | 'captains' | 'volunteers' | 'team:<uuid>'

export const CHAT_RETENTION_DAYS = 30;
/** Messages chargés à l'ouverture d'un salon, puis par « Messages précédents » (économie de trafic). */
export const CHAT_PAGE_SIZE = 70;

/** Clé de salon ↔ segment d'adresse (/chat/club, /chat/bureau, /chat/capitaines, /chat/equipe-<uuid>). */
export function roomToSlug(room: RoomKey): string {
  if (room === "vut") return "vut";
  if (room === "board") return "bureau";
  if (room === "captains") return "capitaines";
  if (room === "volunteers") return "benevoles";
  if (room.startsWith("team:")) return `equipe-${room.slice(5)}`;
  return "club";
}

export function slugToRoom(slug: string): RoomKey | null {
  if (slug === "club") return "club";
  if (slug === "vut") return "vut";
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

/** Réactions possibles sur un message (une de chaque par personne). */
export const REACTIONS = ["👍", "👎", "❤️", "😂", "🏐"] as const;
export type Reaction = (typeof REACTIONS)[number];
export type ReactionRow = { messageId: string; memberId: string; emoji: Reaction };

/** Pastilles d'un message : nombre par emoji (ordre fixe), et si on a soi-même réagi. */
export function reactionSummary(rows: ReactionRow[], messageId: string, meId: string) {
  return REACTIONS.flatMap((emoji) => {
    const who = rows.filter((r) => r.messageId === messageId && r.emoji === emoji).map((r) => r.memberId);
    return who.length ? [{ emoji, count: who.length, mine: who.includes(meId), who }] : [];
  });
}
