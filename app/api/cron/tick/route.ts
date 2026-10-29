import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  closureMessage,
  isClosureDue,
  isReminderDue,
  reminderAudience,
  reminderMessage,
  type ReminderKind,
} from "@/lib/domain/notifications";
import { notifyMembers, type Recipient } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessions, type SessionView } from "@/lib/training";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;

function authorized(request: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const given = request.headers.get("authorization") ?? "";
  return (
    !!process.env.CRON_SECRET &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  );
}

/** Réserve les envois dans le journal : seuls les envois nouvellement réservés sont faits. */
async function claim(admin: Admin, kind: string, sessionId: string, memberIds: string[]) {
  if (!memberIds.length) return new Set<string>();
  const { data, error } = await admin
    .from("notification_log")
    .upsert(
      memberIds.map((member_id) => ({ kind, session_id: sessionId, member_id })),
      { onConflict: "kind,session_id,member_id", ignoreDuplicates: true },
    )
    .select("member_id");
  if (error) throw new Error(`Journal des notifications : ${error.message}`);
  return new Set((data ?? []).map((r) => r.member_id as string));
}

async function recordChannels(admin: Admin, kind: string, sessionId: string, channels: Map<string, string>) {
  await Promise.all(
    [...channels].map(([memberId, channel]) =>
      admin
        .from("notification_log")
        .update({ channel })
        .match({ kind, session_id: sessionId, member_id: memberId }),
    ),
  );
}

async function sendReminders(admin: Admin, session: SessionView, members: Recipient[]) {
  const answers = new Map<string, boolean>();
  const { data } = await admin.from("attendance").select("member_id, present").eq("session_id", session.id);
  for (const a of data ?? []) answers.set(a.member_id, a.present);

  const audience = reminderAudience(members.map((m) => m.id), answers);
  const byId = new Map(members.map((m) => [m.id, m]));
  const sent: Record<ReminderKind, number> = { ask: 0, remind: 0 };

  for (const kind of ["ask", "remind"] as const) {
    const ids = audience.filter((a) => a.kind === kind).map((a) => a.memberId);
    const claimed = await claim(admin, kind, session.id, ids);
    const message = reminderMessage(kind, session.present.length);
    const channels = await notifyMembers([...claimed].map((id) => ({ recipient: byId.get(id)!, message })));
    await recordChannels(admin, kind, session.id, channels);
    sent[kind] = claimed.size;
  }
  return sent;
}

async function closePoll(admin: Admin, session: SessionView, board: Recipient[]) {
  await admin
    .from("training_sessions")
    .update({ poll_closed_at: new Date().toISOString() })
    .eq("id", session.id)
    .is("poll_closed_at", null);
  if (session.freeCourts === 0) return 0;

  const claimed = await claim(admin, "closure", session.id, board.map((m) => m.id));
  const message = closureMessage(session.present.length, session.freeCourts);
  const channels = await notifyMembers(
    board.filter((m) => claimed.has(m.id)).map((recipient) => ({ recipient, message })),
  );
  await recordChannels(admin, "closure", session.id, channels);
  return claimed.size;
}

/**
 * Appelé chaque heure par pg_cron. Selon l'heure de Paris :
 * - notification J-1 (demande aux non-répondants, rappel aux présents) ;
 * - clôture du sondage à 12h le jour J et résumé au Bureau.
 * Idempotent : le journal empêche tout double envoi.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date();

  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "poll_reminder").maybeSingle();
  const sendHour = Number(String(setting?.value?.time ?? "20:00").split(":")[0]);

  // Séances d'aujourd'hui et de demain.
  const sessions = (
    await getSessions({ from: new Date(now.getTime() - 12 * 3600_000), limit: 4, client: admin })
  ).filter((s) => new Date(s.startsAt).getTime() < now.getTime() + 48 * 3600_000);

  const { data: memberRows } = await admin
    .from("members")
    .select("id, email, first_name, roles:member_roles(role)")
    .not("user_id", "is", null);
  const members = (memberRows ?? []) as (Recipient & { roles: { role: string }[] })[];
  const board = members.filter((m) => m.roles.some((r) => r.role === "board"));

  const report: Record<string, unknown>[] = [];
  for (const session of sessions) {
    if (session.freeCourts > 0 && isReminderDue(now, session.startsAt, sendHour)) {
      report.push({ session: session.startsAt, reminders: await sendReminders(admin, session, members) });
    }
    if (isClosureDue(now, session.startsAt) && now.getTime() < new Date(session.startsAt).getTime() + 4 * 3600_000) {
      report.push({ session: session.startsAt, closureNotified: await closePoll(admin, session, board) });
    }
  }
  return NextResponse.json({ ok: true, at: now.toISOString(), report });
}
