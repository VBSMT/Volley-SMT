import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attendanceTotals,
  volunteerCoverage,
  type EventType,
  type Role,
} from "@/lib/domain/events";

export type EventSummary = {
  id: string;
  type: EventType;
  title: string;
  startsAt: string;
  location: string | null;
  visibleRoles: Role[];
};

export type EventDetail = EventSummary & {
  description: string | null;
  attendancePoll: boolean;
  askPartner: boolean;
  askChildren: boolean;
  askGuests: boolean;
  volunteerPoll: boolean;
  totals: ReturnType<typeof attendanceTotals>;
  coming: { name: string; extra: string }[];
  myAttendance: { coming: boolean; with_partner: boolean | null; children: number | null; guests: number | null } | null;
  /** null si l'adhérent n'a pas accès au sondage bénévole (ni bénévole ni Bureau). */
  volunteers: {
    needs: ReturnType<typeof volunteerCoverage>;
    signups: { name: string; available: boolean; need: string | null }[];
    mine: { available: boolean; need_id: string | null } | null;
  } | null;
};

const EVENT_FIELDS = "id, type, title, starts_at, location, visible_roles";

const toSummary = (e: Record<string, unknown>): EventSummary => ({
  id: e.id as string,
  type: e.type as EventType,
  title: e.title as string,
  startsAt: e.starts_at as string,
  location: (e.location as string | null) ?? null,
  visibleRoles: (e.visible_roles as Role[] | null) ?? [],
});

/** Événements visibles (RLS selon les rôles). Vide si la migration n'est pas encore appliquée. */
export async function getEvents(client: SupabaseClient, opts: { past?: boolean; limit?: number } = {}): Promise<EventSummary[]> {
  const now = new Date(Date.now() - 6 * 3600_000).toISOString();
  const q = client.from("events").select(EVENT_FIELDS).limit(opts.limit ?? 50);
  const { data, error } = opts.past
    ? await q.lt("starts_at", now).order("starts_at", { ascending: false })
    : await q.gte("starts_at", now).order("starts_at");
  if (error) return [];
  return (data ?? []).map(toSummary);
}

export async function getEventDetail(
  client: SupabaseClient,
  id: string,
  viewer: { memberId: string; canVolunteer: boolean },
): Promise<EventDetail | null> {
  const { data: e, error } = await client
    .from("events")
    .select(`${EVENT_FIELDS}, description, attendance_poll, ask_partner, ask_children, ask_guests, volunteer_poll`)
    .eq("id", id)
    .maybeSingle();
  if (error || !e) return null;

  const [{ data: answers }, { data: needs }, { data: signups }, { data: directory }] = await Promise.all([
    client.from("event_attendance").select("member_id, coming, with_partner, children, guests, answered_at").eq("event_id", id).order("answered_at"),
    client.from("event_volunteer_needs").select("id, label, needed").eq("event_id", id).order("label"),
    client.from("event_volunteer_signups").select("member_id, available, need_id, answered_at").eq("event_id", id).order("answered_at"),
    client.from("member_directory").select("id, first_name, last_name"),
  ]);
  const names = new Map((directory ?? []).map((m) => [m.id as string, `${m.first_name} ${m.last_name}`]));
  const list = answers ?? [];
  const extra = (a: (typeof list)[number]) =>
    [
      e.ask_partner && a.with_partner && "+ conjoint·e",
      e.ask_children && a.children ? `+ ${a.children} enfant${a.children > 1 ? "s" : ""}` : null,
      e.ask_guests && a.guests ? `+ ${a.guests} invité${a.guests > 1 ? "s" : ""}` : null,
    ]
      .filter(Boolean)
      .join(" ");

  // Sondage bénévole : bénévoles et Bureau uniquement (aussi appliqué par la RLS).
  const canVolunteer = e.volunteer_poll && viewer.canVolunteer;
  const needLabels = new Map((needs ?? []).map((n) => [n.id as string, n.label as string]));
  const mine = (signups ?? []).find((s) => s.member_id === viewer.memberId);
  const myAnswer = list.find((a) => a.member_id === viewer.memberId);

  return {
    ...toSummary(e),
    description: e.description,
    attendancePoll: e.attendance_poll,
    askPartner: e.ask_partner,
    askChildren: e.ask_children,
    askGuests: e.ask_guests,
    volunteerPoll: e.volunteer_poll,
    totals: attendanceTotals(list),
    coming: list.filter((a) => a.coming).map((a) => ({ name: names.get(a.member_id) ?? "Adhérent", extra: extra(a) })),
    myAttendance: myAnswer
      ? { coming: myAnswer.coming, with_partner: myAnswer.with_partner, children: myAnswer.children, guests: myAnswer.guests }
      : null,
    volunteers: canVolunteer
      ? {
          needs: volunteerCoverage(needs ?? [], signups ?? []),
          signups: (signups ?? []).map((s) => ({
            name: names.get(s.member_id) ?? "Adhérent",
            available: s.available,
            need: s.need_id ? (needLabels.get(s.need_id) ?? null) : null,
          })),
          mine: mine ? { available: mine.available, need_id: mine.need_id } : null,
        }
      : null,
  };
}
