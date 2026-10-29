"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { RescheduleStatus } from "@/lib/domain/reschedule";
import { captainTeamIds, getCurrentMember, hasRole } from "@/lib/member";
import { notifyRescheduleChange, transitionReschedule } from "@/lib/reschedule-server";
import { createClient } from "@/lib/supabase/server";
import { getSessions } from "@/lib/training";

/** Demande de report d'un match à domicile vers un créneau libre (capitaine de l'équipe ou Bureau). */
export async function requestReschedule(matchId: string, sessionId: string, note: string): Promise<{ error?: string; id?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };

  const supabase = await createClient();
  const { data: match } = await supabase.from("matches").select("id, team_id, is_home, starts_at").eq("id", matchId).maybeSingle();
  const isBoard = hasRole(member, "board");
  if (!match || !(isBoard || captainTeamIds(member).includes(match.team_id))) {
    return { error: "Réservé au capitaine de l'équipe ou au Bureau." };
  }
  if (!match.is_home) return { error: "Seuls les matchs à domicile utilisent notre gymnase." };

  // Le créneau doit être à venir et avoir encore un terrain libre.
  const { data: s } = await supabase.from("training_sessions").select("starts_at").eq("id", sessionId).maybeSingle();
  if (!s) return { error: "Créneau introuvable." };
  const [slot] = await getSessions({ from: new Date(Date.parse(s.starts_at) - 1000), limit: 1 });
  if (!slot || slot.id !== sessionId || Date.parse(slot.startsAt) <= Date.now()) return { error: "Créneau passé." };
  if (slot.freeCourts < 1) return { error: "Plus de terrain libre sur ce créneau." };

  const { data: created, error } = await supabase
    .from("reschedule_requests")
    .insert({ match_id: matchId, requested_session_id: sessionId, requested_by: member.id, note: note.trim().slice(0, 300) || null })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "Une demande est déjà en cours pour ce match." : "Demande non enregistrée." };
  }
  after(() => notifyRescheduleChange(created.id, "requested", { exclude: member.id }));
  revalidatePath("/", "layout");
  return { id: created.id };
}

/** Changement d'état par le capitaine (abandon) ou le Bureau (validation, refus, modification). */
export async function updateReschedule(requestId: string, to: RescheduleStatus, note?: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const actor = hasRole(member, "board") ? "board" : "captain";

  const supabase = await createClient();
  const result = await transitionReschedule(supabase, requestId, to, actor, note?.trim() ? note.trim().slice(0, 300) : undefined);
  if (result.error) return result;
  // Le capitaine est prévenu des décisions du Bureau (et des modifications de décision).
  if (actor === "board" || to === "abandoned") after(() => notifyRescheduleChange(requestId, to, { exclude: member.id }));
  revalidatePath("/", "layout");
  return {};
}
