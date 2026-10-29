import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  closureMessage,
  isClosureDue,
  isMatchReminderDue,
  isReminderDue,
  matchMessage,
  reminderAudience,
  reminderMessage,
  type ReminderKind,
} from "@/lib/domain/notifications";
import { generateLineup } from "@/lib/lineup-server";
import { claimNotifications, recordChannels } from "@/lib/notification-log";
import { runRescheduleMaintenance } from "@/lib/reschedule-server";
import { notifyMembers, type Recipient } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessions, type SessionView } from "@/lib/training";
import { isVolley34SyncDue, runVolley34Sync } from "@/lib/volley34-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;
type Member = Recipient & {
  team_ids: string[];
  notify_training: boolean;
  notify_match: boolean;
  roles: { role: string }[];
};

function authorized(request: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const given = request.headers.get("authorization") ?? "";
  return (
    !!process.env.CRON_SECRET &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  );
}

/** Réserve puis envoie un message à chaque destinataire, et note le canal utilisé. */
async function send(
  admin: Admin,
  kind: string,
  target: Parameters<typeof claimNotifications>[2],
  recipients: { recipient: Recipient; message: Parameters<typeof notifyMembers>[0][number]["message"] }[],
) {
  const claimed = await claimNotifications(admin, kind, target, recipients.map((r) => r.recipient.id));
  const channels = await notifyMembers(recipients.filter((r) => claimed.has(r.recipient.id)));
  await recordChannels(admin, kind, target, channels);
  return claimed.size;
}

async function sendReminders(admin: Admin, session: SessionView, members: Member[]) {
  const { data } = await admin.from("attendance").select("member_id, present").eq("session_id", session.id);
  const answers = new Map((data ?? []).map((a) => [a.member_id as string, a.present as boolean]));
  const wanting = members.filter((m) => m.notify_training);
  const audience = reminderAudience(wanting.map((m) => m.id), answers);
  const byId = new Map(wanting.map((m) => [m.id, m]));

  const sent: Record<ReminderKind, number> = { ask: 0, remind: 0 };
  for (const kind of ["ask", "remind"] as const) {
    const message = reminderMessage(kind, session.present.length);
    sent[kind] = await send(
      admin,
      kind,
      { session_id: session.id },
      audience.filter((a) => a.kind === kind).map((a) => ({ recipient: byId.get(a.memberId)!, message })),
    );
  }
  return sent;
}

async function closePoll(admin: Admin, session: SessionView, board: Member[]) {
  await admin
    .from("training_sessions")
    .update({ poll_closed_at: new Date().toISOString() })
    .eq("id", session.id)
    .is("poll_closed_at", null);
  if (session.freeCourts === 0) return 0;
  // Compo générée une seule fois à la clôture (le Bureau peut la régénérer depuis l'écran).
  const { data: existing } = await admin.from("lineups").select("session_id").eq("session_id", session.id).maybeSingle();
  const lineup = existing ? null : await generateLineup(admin, session);
  const message = closureMessage(session.present.length, session.freeCourts, lineup?.warnings.length ?? 0);
  return send(admin, "closure", { session_id: session.id }, board.map((recipient) => ({ recipient, message })));
}

async function sendMatchReminders(admin: Admin, now: Date, sendHour: number, members: Member[]) {
  const { data: matches } = await admin
    .from("matches")
    .select("id, team_id, starts_at, opponent, is_home, venue, city, team:teams(name)")
    .gte("starts_at", new Date(now.getTime() + 24 * 3600_000).toISOString())
    .lte("starts_at", new Date(now.getTime() + 80 * 3600_000).toISOString());

  const report: Record<string, unknown>[] = [];
  for (const m of matches ?? []) {
    if (!isMatchReminderDue(now, m.starts_at, sendHour)) continue;
    const team = m.team as unknown as { name: string } | null;
    const message = matchMessage({
      startsAt: m.starts_at,
      teamName: team?.name ?? "",
      opponent: m.opponent,
      isHome: m.is_home,
      venue: m.venue,
      city: m.city,
    });
    const players = members.filter((p) => p.team_ids.includes(m.team_id) && p.notify_match);
    report.push({
      match: m.starts_at,
      team: team?.name,
      sent: await send(admin, "match", { match_id: m.id }, players.map((recipient) => ({ recipient, message }))),
    });
  }
  return report;
}

/**
 * Appelé chaque heure par pg_cron. Selon l'heure de Paris :
 * - notification J-1 des entraînements (demande aux non-répondants, rappel aux présents) ;
 * - clôture du sondage à 12h le jour J, génération de la compo et notification au Bureau ;
 * - rappel J-2 des matchs aux joueurs de l'équipe ;
 * - synchro quotidienne du calendrier volley34 (à partir de 6h, jusqu'à réussite) ;
 * - reports : confirmation par la synchro, expiration automatique à J-3.
 * Idempotent : le journal empêche tout double envoi.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date();

  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "poll_reminder").maybeSingle();
  const sendHour = Number(String(setting?.value?.time ?? "20:00").split(":")[0]);

  const { data: memberRows } = await admin
    .from("members")
    .select("id, email, first_name, notify_training, notify_match, roles:member_roles(role), member_teams(team_id)")
    .not("user_id", "is", null);
  const members: Member[] = (memberRows ?? []).map(({ member_teams, ...m }) => ({
    ...(m as Omit<Member, "team_ids">),
    team_ids: (member_teams as { team_id: string }[]).map((t) => t.team_id),
  }));
  const board = members.filter((m) => m.roles.some((r) => r.role === "board"));

  // Séances d'aujourd'hui et de demain.
  const sessions = (
    await getSessions({ from: new Date(now.getTime() - 12 * 3600_000), limit: 4, client: admin })
  ).filter((s) => new Date(s.startsAt).getTime() < now.getTime() + 48 * 3600_000);

  const report: Record<string, unknown>[] = [];
  // Synchro d'abord : les rappels de match utilisent alors les dates à jour.
  if (await isVolley34SyncDue(admin, now)) report.push({ volley34: await runVolley34Sync(admin, board) });
  // Reports : confirmation (après la synchro) et expiration à J-3.
  report.push({ reschedules: await runRescheduleMaintenance(admin, now) });

  for (const session of sessions) {
    if (session.freeCourts > 0 && isReminderDue(now, session.startsAt, sendHour)) {
      report.push({ session: session.startsAt, reminders: await sendReminders(admin, session, members) });
    }
    if (isClosureDue(now, session.startsAt) && now.getTime() < new Date(session.startsAt).getTime() + 4 * 3600_000) {
      report.push({ session: session.startsAt, closureNotified: await closePoll(admin, session, board) });
    }
  }
  report.push(...(await sendMatchReminders(admin, now, sendHour, members)));

  return NextResponse.json({ ok: true, at: now.toISOString(), report });
}
