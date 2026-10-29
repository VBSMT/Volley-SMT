import { closureReason } from "@/lib/domain/calendar";
import { freeCourts, parisDate, pollDeadline } from "@/lib/domain/training";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSchedule } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export type SessionView = {
  id: string;
  startsAt: string;
  openCourts: number;
  homeMatches: number;
  approvedReschedules: number;
  freeCourts: number;
  closedReason: string | null; // vacances / férié (affichage)
  pollOpen: boolean;
  present: { id: string; name: string }[];
  absentCount: number;
  myAnswer: boolean | null;
};

/** Séances avec terrains libres et réponses au sondage (lecture autorisée à tout adhérent). */
export async function getSessions(opts: {
  from: Date;
  limit: number;
  memberId?: string;
  /** Client à utiliser (par défaut : celui de l'utilisateur connecté). */
  client?: SupabaseClient;
}): Promise<SessionView[]> {
  const supabase = opts.client ?? (await createClient());
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, starts_at, open_courts, poll_closed_at")
    .gte("starts_at", opts.from.toISOString())
    .order("starts_at")
    .limit(opts.limit);
  if (!sessions?.length) return [];

  const ids = sessions.map((s) => s.id as string);
  const first = sessions[0].starts_at as string;
  const last = sessions.at(-1)!.starts_at as string;
  const dayMs = 86_400_000;

  const [{ data: matches }, { data: reschedules }, { data: attendance }, { data: directory }, schedule] =
    await Promise.all([
      supabase
        .from("matches")
        .select("starts_at")
        .eq("is_home", true)
        .gte("starts_at", new Date(new Date(first).getTime() - dayMs).toISOString())
        .lte("starts_at", new Date(new Date(last).getTime() + dayMs).toISOString()),
      supabase
        .from("reschedule_requests")
        .select("requested_session_id")
        .eq("status", "approved")
        .in("requested_session_id", ids),
      supabase.from("attendance").select("session_id, member_id, present").in("session_id", ids),
      supabase.from("member_directory").select("id, first_name, last_name"),
      getSchedule(supabase, opts.client ? "table" : "view"),
    ]);

  const homeByDate = new Map<string, number>();
  for (const m of matches ?? []) {
    const d = parisDate(m.starts_at);
    homeByDate.set(d, (homeByDate.get(d) ?? 0) + 1);
  }
  const names = new Map(
    (directory ?? []).map((m) => [m.id as string, `${m.first_name} ${m.last_name}`]),
  );
  const now = Date.now();

  return sessions.map((s) => {
    const date = parisDate(s.starts_at);
    const homeMatches = homeByDate.get(date) ?? 0;
    const approved = (reschedules ?? []).filter((r) => r.requested_session_id === s.id).length;
    const answers = (attendance ?? []).filter((a) => a.session_id === s.id);
    const free = freeCourts(s.open_courts, homeMatches, approved);
    const mine = answers.find((a) => a.member_id === opts.memberId);
    return {
      id: s.id,
      startsAt: s.starts_at,
      openCourts: s.open_courts,
      homeMatches,
      approvedReschedules: approved,
      freeCourts: free,
      closedReason: s.open_courts === 0 ? closureReason(date) : null,
      pollOpen: free > 0 && !s.poll_closed_at && now < pollDeadline(s.starts_at, schedule.closeHour).getTime(),
      present: answers
        .filter((a) => a.present)
        .map((a) => ({ id: a.member_id, name: names.get(a.member_id) ?? "Adhérent" }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
      absentCount: answers.filter((a) => !a.present).length,
      myAnswer: mine ? mine.present : null,
    };
  });
}
