import { shortName } from "@/lib/format";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rescheduleDecisionMessage,
  rescheduleRequestedMessage,
  type RescheduleInfo,
} from "@/lib/domain/notifications";
import {
  canTransition,
  isConfirmedBySync,
  isExpired,
  type Actor,
  type RescheduleStatus,
} from "@/lib/domain/reschedule";
import { notifyMembers, type Recipient } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export type RescheduleView = {
  id: string;
  status: RescheduleStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy: string | null;
  match: { id: string; teamId: string; teamName: string; opponent: string; startsAt: string };
  slot: { id: string; startsAt: string };
};

const SELECT = `id, status, note, created_at, updated_at, requested_by,
  requester:members!reschedule_requests_requested_by_fkey(first_name, last_name),
  match:matches(id, team_id, opponent, starts_at, team:teams(name)),
  slot:training_sessions!reschedule_requests_requested_session_id_fkey(id, starts_at)`;

type Row = {
  id: string;
  status: RescheduleStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  requester: { first_name: string; last_name: string } | null;
  match: { id: string; team_id: string; opponent: string; starts_at: string; team: { name: string } | null };
  slot: { id: string; starts_at: string };
};

const toView = (r: Row): RescheduleView => ({
  id: r.id,
  status: r.status,
  note: r.note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  requestedBy: r.requester ? shortName(r.requester.first_name, r.requester.last_name) : null,
  match: {
    id: r.match.id,
    teamId: r.match.team_id,
    teamName: r.match.team?.name ?? "",
    opponent: r.match.opponent,
    startsAt: r.match.starts_at,
  },
  slot: { id: r.slot.id, startsAt: r.slot.starts_at },
});

/** Reports (lecture soumise à la RLS). */
export async function getReschedules(
  client: SupabaseClient,
  filter: { id?: string; matchId?: string; statuses?: RescheduleStatus[]; limit?: number } = {},
): Promise<RescheduleView[]> {
  let q = client.from("reschedule_requests").select(SELECT).order("created_at", { ascending: false });
  if (filter.id) q = q.eq("id", filter.id);
  if (filter.matchId) q = q.eq("match_id", filter.matchId);
  if (filter.statuses) q = q.in("status", filter.statuses);
  const { data, error } = await q.limit(filter.limit ?? 100);
  if (error) return [];
  return (data as unknown as Row[]).map(toView);
}

export type RescheduleEvent = { id: number; requestId: string; to: RescheduleStatus; from: RescheduleStatus | null; actor: string; at: string };

/** Journal horodaté (Bureau, et capitaine pour son équipe). */
export async function getRescheduleEvents(client: SupabaseClient, requestIds?: string[], limit = 60): Promise<RescheduleEvent[]> {
  let q = client
    .from("reschedule_events")
    .select("id, request_id, from_status, to_status, created_at, actor:members(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (requestIds) q = q.in("request_id", requestIds);
  const { data } = await q;
  return (data ?? []).map((e) => {
    const actor = e.actor as unknown as { first_name: string; last_name: string } | null;
    return {
      id: e.id,
      requestId: e.request_id,
      from: e.from_status,
      to: e.to_status,
      actor: actor ? shortName(actor.first_name, actor.last_name) : "Automatique",
      at: e.created_at,
    };
  });
}

const info = (r: RescheduleView): RescheduleInfo => ({
  matchId: r.match.id,
  teamName: r.match.teamName,
  opponent: r.match.opponent,
  matchStartsAt: r.match.startsAt,
  slotStartsAt: r.slot.startsAt,
});

async function recipients(admin: SupabaseClient, filter: { captainsOf?: string; board?: boolean }): Promise<Recipient[]> {
  let q = admin.from("member_roles").select("role, team_id, member:members!inner(id, email, first_name, user_id)");
  q = filter.board ? q.eq("role", "board") : q.eq("role", "captain").eq("team_id", filter.captainsOf!);
  const { data } = await q;
  const seen = new Map<string, Recipient>();
  for (const r of data ?? []) {
    const m = r.member as unknown as Recipient & { user_id: string | null };
    if (m.user_id) seen.set(m.id, { id: m.id, email: m.email, first_name: m.first_name });
  }
  return [...seen.values()];
}

/** Notifie après un changement : Bureau pour une demande, capitaines de l'équipe sinon. */
export async function notifyRescheduleChange(
  requestId: string,
  status: RescheduleStatus,
  options: { reason?: "expired"; exclude?: string } = {},
) {
  const admin = createAdminClient();
  const [r] = await getReschedules(admin, { id: requestId });
  if (!r) return;
  if (status === "requested") {
    const board = await recipients(admin, { board: true });
    const message = rescheduleRequestedMessage(info(r));
    await notifyMembers(board.filter((b) => b.id !== options.exclude).map((recipient) => ({ recipient, message })));
    return;
  }
  const captains = await recipients(admin, { captainsOf: r.match.teamId });
  const message = rescheduleDecisionMessage(info(r), status as "approved" | "rejected" | "abandoned" | "confirmed", options.reason);
  const all = status === "abandoned" && options.reason === "expired" ? [...captains, ...(await recipients(admin, { board: true }))] : captains;
  const unique = [...new Map(all.map((m) => [m.id, m])).values()].filter((m) => m.id !== options.exclude);
  await notifyMembers(unique.map((recipient) => ({ recipient, message })));
}

/** Change le statut si la transition est autorisée pour cet acteur. */
export async function transitionReschedule(
  client: SupabaseClient,
  requestId: string,
  to: RescheduleStatus,
  actor: Actor,
  note?: string | null,
): Promise<{ error?: string }> {
  const { data: current } = await client.from("reschedule_requests").select("status").eq("id", requestId).maybeSingle();
  if (!current) return { error: "Demande introuvable." };
  if (!canTransition(current.status, to, actor)) return { error: "Action impossible dans l'état actuel de la demande." };
  const { data, error } = await client
    .from("reschedule_requests")
    .update({ status: to, ...(note !== undefined && { note }) })
    .eq("id", requestId)
    .eq("status", current.status)
    .select("id");
  if (error || !data?.length) return { error: "Mise à jour impossible (déjà modifiée ?)." };
  return {};
}

/**
 * Maintenance (appel horaire) : confirmation quand volley34 montre le match à la nouvelle date,
 * sinon expiration à J-3 de la date demandée (pré-réservation libérée).
 */
export async function runRescheduleMaintenance(admin: SupabaseClient, now: Date, expiryDays = 3) {
  const active = await getReschedules(admin, { statuses: ["requested", "approved"] });
  const report = { confirmed: 0, expired: 0 };
  for (const r of active) {
    if (r.status === "approved" && isConfirmedBySync(r.match.startsAt, r.slot.startsAt)) {
      if (!(await transitionReschedule(admin, r.id, "confirmed", "system")).error) {
        report.confirmed++;
        await notifyRescheduleChange(r.id, "confirmed");
      }
    } else if (isExpired(now, r.slot.startsAt, expiryDays)) {
      if (!(await transitionReschedule(admin, r.id, "abandoned", "system", `Expiration automatique à J-${expiryDays}`)).error) {
        report.expired++;
        await notifyRescheduleChange(r.id, "abandoned", { reason: "expired" });
      }
    }
  }
  return report;
}
