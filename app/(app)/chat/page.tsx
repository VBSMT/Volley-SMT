import type { Metadata } from "next";
import Link from "next/link";
import { getRooms, getUnread } from "@/lib/chat";
import { CHAT_RETENTION_DAYS } from "@/lib/domain/chat";
import { formatTime } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

/** Liste des salons accessibles, avec non-lus et dernier message. */
export default async function ChatPage() {
  const member = (await getCurrentMember())!;
  const supabase = await createClient();
  const rooms = await getRooms(supabase, member);
  const [unread, { data: last }] = await Promise.all([
    getUnread(supabase),
    supabase.from("chat_messages").select("room, body, created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  const lastByRoom = new Map<string, { body: string; created_at: string }>();
  for (const m of last ?? []) if (!lastByRoom.has(m.room)) lastByRoom.set(m.room, m);

  return (
    <main className="page stack">
      <h1>Messages</h1>
      <p className="muted small">Messages effacés automatiquement au bout de {CHAT_RETENTION_DAYS} jours.</p>
      <ul className="list">
        {rooms.map((r) => {
          const n = unread.get(r.key) ?? 0;
          const l = lastByRoom.get(r.key);
          return (
            <li key={r.key}>
              <Link href={`/chat/${r.slug}`} className="card card-link chat-room-link">
                <span className="chat-room-name">
                  {r.label}
                  {n > 0 && <span className="chat-badge" aria-label={`${n} non lu${n > 1 ? "s" : ""}`}>{n}</span>}
                </span>
                <span className="muted small chat-room-last">
                  {l ? `${formatTime(l.created_at)} · ${l.body}` : "Aucun message"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
