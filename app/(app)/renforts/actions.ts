"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  offerMessage,
  reinforcementAudience,
  reinforcementMessage,
  type Position,
  type Sex,
} from "@/lib/domain/notifications";
import { captainTeamIds, getCurrentMember, hasRole } from "@/lib/member";
import { claimNotifications, recordChannels } from "@/lib/notification-log";
import { notifyMembers } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RequestState = { status: "idle" | "error"; message?: string };

const POSITIONS: Position[] = ["setter", "front", "back"];
const SEXES: Sex[] = ["F", "M"];

/** Notifie les adhérents concernés, après la réponse (l'utilisateur n'attend pas l'envoi). */
function notifyNewRequest(requestId: string) {
  after(async () => {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reinforcement_requests")
      .select("id, team_id, captain_id, position, sex, team:teams(name), match:matches(starts_at)")
      .eq("id", requestId)
      .single();
    if (!r) return;
    const { data: members } = await admin
      .from("members")
      .select("id, email, first_name, sex, team_id, notify_reinforcement")
      .not("user_id", "is", null);
    const audience = reinforcementAudience(members ?? [], { teamId: r.team_id, sex: r.sex, captainId: r.captain_id });
    const message = reinforcementMessage({
      teamName: (r.team as unknown as { name: string }).name,
      matchStartsAt: (r.match as unknown as { starts_at: string }).starts_at,
      sex: r.sex,
      position: r.position,
    });
    const target = { reinforcement_id: r.id };
    const claimed = await claimNotifications(admin, "reinforcement", target, audience.map((m) => m.id));
    const channels = await notifyMembers(
      audience.filter((m) => claimed.has(m.id)).map((recipient) => ({ recipient, message })),
    );
    await recordChannels(admin, "reinforcement", target, channels);
  });
}

export async function createReinforcement(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const member = await getCurrentMember();
  if (!member) return { status: "error", message: "Session expirée. Reconnectez-vous." };

  const matchId = String(formData.get("match_id") ?? "");
  const position = String(formData.get("position") ?? "");
  const sex = String(formData.get("sex") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;

  const supabase = await createClient();
  const { data: match } = await supabase.from("matches").select("id, team_id, starts_at").eq("id", matchId).maybeSingle();
  if (!match || !captainTeamIds(member).includes(match.team_id)) {
    return { status: "error", message: "Vous n'êtes pas capitaine de cette équipe." };
  }
  if (new Date(match.starts_at).getTime() <= Date.now()) {
    return { status: "error", message: "Ce match est déjà passé." };
  }

  const { data: created, error } = await supabase
    .from("reinforcement_requests")
    .insert({
      match_id: match.id,
      team_id: match.team_id,
      captain_id: member.id,
      position: POSITIONS.includes(position as Position) ? position : null,
      sex: SEXES.includes(sex as Sex) ? sex : null,
      note,
    })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Demande non enregistrée. Réessayez." };

  notifyNewRequest(created.id);
  revalidatePath("/", "layout");
  redirect("/accueil");
}

export async function offerHelp(requestId: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };

  const supabase = await createClient();
  const { error } = await supabase.from("reinforcement_offers").insert({ request_id: requestId, member_id: member.id });
  if (error && error.code !== "23505") return { error: "Proposition non enregistrée. Réessayez." };

  // Prévient le capitaine (une seule fois par volontaire).
  after(async () => {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reinforcement_requests")
      .select("id, team:teams(name), captain:members!reinforcement_requests_captain_id_fkey(id, email, first_name)")
      .eq("id", requestId)
      .single();
    const captain = r?.captain as unknown as { id: string; email: string; first_name: string } | null;
    if (!r || !captain) return;
    const target = { reinforcement_id: r.id };
    // Journal : pour « offer », member_id = le volontaire (un message au capitaine par volontaire).
    const claimed = await claimNotifications(admin, "offer", target, [member.id]);
    if (!claimed.size) return;
    const message = offerMessage(`${member.first_name} ${member.last_name}`, (r.team as unknown as { name: string }).name);
    const channels = await notifyMembers([{ recipient: captain, message }]);
    await recordChannels(admin, "offer", target, new Map([[member.id, channels.get(captain.id) ?? "none"]]));
  });

  revalidatePath("/accueil");
  return {};
}

export async function withdrawHelp(requestId: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const supabase = await createClient();
  const { error } = await supabase.from("reinforcement_offers").delete().match({ request_id: requestId, member_id: member.id });
  if (error) return { error: "Action impossible. Réessayez." };
  revalidatePath("/accueil");
  return {};
}

export async function closeReinforcement(requestId: string, status: "filled" | "cancelled"): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  if (!captainTeamIds(member).length && !hasRole(member, "board")) return { error: "Action réservée au capitaine." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reinforcement_requests")
    .update({ status, closed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "open")
    .select("id");
  if (error || !data?.length) return { error: "Action impossible." };
  revalidatePath("/", "layout");
  return {};
}
