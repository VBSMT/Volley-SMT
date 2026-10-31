import "server-only";
import { roomToSlug, type RoomKey } from "@/lib/domain/chat";
import { shortName } from "@/lib/format";
import { hasRole, type CurrentMember } from "@/lib/member";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Admin = ReturnType<typeof createAdminClient>;

export type Room = { key: RoomKey; slug: string; label: string };

/** Salons accessibles : Club, VUT, ses équipes (joueurs seulement, Bureau compris), Capitaines, Bénévoles, Bureau. */
export async function getRooms(client: Client, member: CurrentMember): Promise<Room[]> {
  const isBoard = hasRole(member, "board");
  const room = (key: RoomKey, label: string): Room => ({ key, slug: roomToSlug(key), label });
  const rooms: Room[] = [room("club", "Tout le club"), room("vut", "VUT")];
  for (const t of member.teams) rooms.push(room(`team:${t.id}`, t.name));
  if (isBoard || hasRole(member, "captain")) rooms.push(room("captains", "Capitaines"));
  if (isBoard || hasRole(member, "volunteer")) rooms.push(room("volunteers", "Bénévoles"));
  if (isBoard) rooms.push(room("board", "Bureau"));
  return rooms;
}

/** Membres (avec compte) d'un salon, pour les notifications et les mentions. */
export async function roomMembers(admin: Admin, room: RoomKey) {
  const select = "id, email, first_name, last_name, notify_mentions";
  let q;
  if (room === "club" || room === "vut") q = admin.from("members").select(select);
  else if (room === "board" || room === "captains" || room === "volunteers") {
    const roles = room === "board" ? ["board"] : room === "captains" ? ["captain", "board"] : ["volunteer", "board"];
    q = admin.from("members").select(`${select}, member_roles!inner(role)`).in("member_roles.role", roles);
  } else {
    const teamId = room.slice(5);
    const { data: teamRows } = await admin.from("member_teams").select("member_id").eq("team_id", teamId);
    const ids = [...new Set((teamRows ?? []).map((r) => r.member_id as string))];
    q = admin.from("members").select(select).in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data } = await q.not("user_id", "is", null);
  const unique = new Map((data ?? []).map((m) => [m.id as string, m]));
  return [...unique.values()].map((m) => ({
    id: m.id as string,
    email: m.email as string,
    first_name: m.first_name as string,
    name: shortName(m.first_name as string, m.last_name as string),
    notifyMentions: !!m.notify_mentions,
  }));
}

/** Nombre de messages non lus, par salon. */
export async function getUnread(client: Client): Promise<Map<RoomKey, number>> {
  const { data } = await client.rpc("chat_unread");
  return new Map(((data ?? []) as { room: string; unread: number }[]).map((r) => [r.room, Number(r.unread)]));
}
