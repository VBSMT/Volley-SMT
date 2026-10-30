import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRooms } from "@/lib/chat";
import { CHAT_PAGE_SIZE, CHAT_RETENTION_DAYS, slugToRoom } from "@/lib/domain/chat";
import { shortName } from "@/lib/format";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { ChatRoom } from "./ChatRoom";

export const metadata: Metadata = { title: "Messages" };

export default async function ChatRoomPage({ params }: { params: Promise<{ room: string }> }) {
  const roomKey = slugToRoom((await params).room);
  const member = (await getCurrentMember())!;
  const supabase = await createClient();
  const room = roomKey ? (await getRooms(supabase, member)).find((r) => r.key === roomKey) : null;
  if (!room) notFound();

  const since = new Date(Date.now() - CHAT_RETENTION_DAYS * 86_400_000).toISOString();
  const [{ data: messages }, { data: directory }, { data: pref }] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("id, author_id, body, created_at")
      .eq("room", room.key)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(CHAT_PAGE_SIZE),
    supabase.from("member_directory").select("id, first_name, last_name"),
    supabase.from("chat_room_prefs").select("notify").eq("room", room.key).maybeSingle(),
  ]);
  const names = Object.fromEntries((directory ?? []).map((m) => [m.id as string, shortName(m.first_name, m.last_name)]));

  return (
    <main className="page stack chat-page">
      <Link href="/chat" className="back">← Messages</Link>
      <ChatRoom
        room={room.key}
        label={room.label}
        meId={member.id}
        isBoard={hasRole(member, "board")}
        names={names}
        initial={(messages ?? []).reverse().map((m) => ({ id: m.id, authorId: m.author_id, body: m.body, createdAt: m.created_at }))}
        notify={!!pref?.notify}
        hasMore={(messages ?? []).length === CHAT_PAGE_SIZE}
      />
    </main>
  );
}
