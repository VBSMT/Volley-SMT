"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { roomMembers } from "@/lib/chat";
import { CHAT_PAGE_SIZE, CHAT_RETENTION_DAYS, REACTIONS, mentionedIds, roomToSlug } from "@/lib/domain/chat";
import { shortName } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { notifyMembers } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ROOM_LABELS: Record<string, string> = { club: "Tout le club", board: "Bureau", captains: "Capitaines", volunteers: "Bénévoles" };

/** Envoie un message (droits vérifiés en base) puis notifie : abonnés du salon, et personnes citées qui l'ont choisi. */
type ChatMsg = { id: string; authorId: string | null; body: string; createdAt: string };

export async function sendMessage(room: string, body: string): Promise<{ error?: string; message?: ChatMsg }> {
  const me = await getCurrentMember();
  if (!me) return { error: "Session expirée. Reconnectez-vous." };
  const text = body.trim().slice(0, 1000);
  if (!text) return {};
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("chat_messages")
    .insert({ room, author_id: me.id, body: text })
    .select("id, author_id, body, created_at")
    .single();
  if (error || !row) return { error: "Message non envoyé." };

  after(async () => {
    const admin = createAdminClient();
    const people = await roomMembers(admin, room);
    const { data: prefs } = await admin.from("chat_room_prefs").select("member_id").eq("room", room).eq("notify", true);
    const subscribed = new Set((prefs ?? []).map((p) => p.member_id as string));
    const mentioned = new Set(mentionedIds(text, people));
    let label = ROOM_LABELS[room];
    if (!label) label = ((await admin.from("teams").select("name").eq("id", room.slice(5)).maybeSingle()).data?.name as string) ?? "Équipe";
    const author = shortName(me.first_name, me.last_name);
    const url = `/chat/${roomToSlug(room)}`;
    const recipients = people
      .filter((p) => p.id !== me.id && (subscribed.has(p.id) || (mentioned.has(p.id) && p.notifyMentions)))
      .map((p) => ({
        recipient: { id: p.id, email: p.email, first_name: p.first_name },
        message: {
          title: mentioned.has(p.id) ? `💬 ${author} t'a cité · ${label}` : `💬 ${label}`,
          body: `${author} : ${text.slice(0, 140)}`,
          url,
        },
      }));
    if (recipients.length) await notifyMembers(recipients);
  });
  return { message: { id: row.id, authorId: row.author_id, body: row.body, createdAt: row.created_at } };
}

/** Supprime un message (le sien, ou n'importe lequel pour le Bureau : droits en base). */
export async function deleteMessage(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("chat_messages").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "Suppression impossible." };
  return {};
}

/** Signale un message au Bureau (notification). */
export async function reportMessage(id: string): Promise<{ error?: string }> {
  const me = await getCurrentMember();
  if (!me) return { error: "Session expirée. Reconnectez-vous." };
  const supabase = await createClient();
  const { data: msg } = await supabase.from("chat_messages").select("room, body").eq("id", id).maybeSingle();
  if (!msg) return { error: "Message introuvable." };
  after(async () => {
    const admin = createAdminClient();
    const board = await roomMembers(admin, "board");
    await notifyMembers(
      board.map((p) => ({
        recipient: { id: p.id, email: p.email, first_name: p.first_name },
        message: {
          title: "⚠️ Message signalé",
          body: `${shortName(me.first_name, me.last_name)} signale : « ${String(msg.body).slice(0, 120)} »`,
          // Salon d'équipe : le Bureau n'y a pas accès, le texte du message est dans la notification.
          url: String(msg.room).startsWith("team:") ? "/chat" : `/chat/${roomToSlug(msg.room as string)}`,
        },
      })),
    );
  });
  return {};
}

/** Marque le salon comme lu. */
export async function markRead(room: string): Promise<void> {
  const me = await getCurrentMember();
  if (!me) return;
  const supabase = await createClient();
  await supabase
    .from("chat_room_prefs")
    .upsert({ member_id: me.id, room, last_read_at: new Date().toISOString() }, { onConflict: "member_id,room" });
  revalidatePath("/", "layout");
}

/** Notification de chaque message du salon : activée / désactivée. */
export async function setRoomNotify(room: string, notify: boolean): Promise<{ error?: string }> {
  const me = await getCurrentMember();
  if (!me) return { error: "Session expirée. Reconnectez-vous." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_room_prefs")
    .upsert({ member_id: me.id, room, notify }, { onConflict: "member_id,room" });
  return error ? { error: "Réglage non enregistré." } : {};
}

/** « Messages précédents » : les 70 messages avant le plus ancien affiché (dans la durée de conservation). */
export async function loadOlder(
  room: string,
  before: string,
): Promise<{ messages: { id: string; authorId: string | null; body: string; createdAt: string }[]; hasMore: boolean }> {
  const supabase = await createClient();
  const since = new Date(Date.now() - CHAT_RETENTION_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from("chat_messages")
    .select("id, author_id, body, created_at")
    .eq("room", room)
    .lt("created_at", before)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE_SIZE);
  const rows = data ?? [];
  return {
    messages: rows.reverse().map((m) => ({ id: m.id, authorId: m.author_id, body: m.body, createdAt: m.created_at })),
    hasMore: rows.length === CHAT_PAGE_SIZE,
  };
}

/** Messages arrivés après une date (secours si le temps réel est coupé). */
export async function loadNewer(room: string, after: string): Promise<ChatMsg[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_messages")
    .select("id, author_id, body, created_at")
    .eq("room", room)
    .gt("created_at", after)
    .order("created_at")
    .limit(CHAT_PAGE_SIZE);
  return (data ?? []).map((m) => ({ id: m.id, authorId: m.author_id, body: m.body, createdAt: m.created_at }));
}

/** Ajoute ou retire sa réaction sur un message (droits vérifiés en base : salon accessible). */
export async function toggleReaction(messageId: string, emoji: string, on: boolean): Promise<{ error?: string }> {
  const me = await getCurrentMember();
  if (!me) return { error: "Session expirée. Reconnectez-vous." };
  if (!(REACTIONS as readonly string[]).includes(emoji)) return { error: "Réaction inconnue." };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("chat_reactions").upsert({ message_id: messageId, member_id: me.id, emoji }, { onConflict: "message_id,member_id,emoji", ignoreDuplicates: true })
    : await supabase.from("chat_reactions").delete().eq("message_id", messageId).eq("member_id", me.id).eq("emoji", emoji);
  return error ? { error: "Réaction non enregistrée." } : {};
}
