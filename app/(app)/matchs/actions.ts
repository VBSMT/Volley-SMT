"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { matchPollMessage } from "@/lib/domain/notifications";
import { captainTeamIds, getCurrentMember } from "@/lib/member";
import { claimNotifications, recordChannels } from "@/lib/notification-log";
import { notifyMembers } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Le capitaine lance le sondage de présence d'un match de son équipe ; l'équipe est notifiée. */
export async function launchMatchPoll(matchId: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("id, team_id, starts_at, opponent, team:teams(name)")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || !captainTeamIds(member).includes(match.team_id)) return { error: "Réservé au capitaine de l'équipe." };
  if (Date.parse(match.starts_at) <= Date.now()) return { error: "Ce match est déjà passé." };

  const { error } = await supabase.from("match_polls").insert({ match_id: matchId, created_by: member.id });
  if (error && error.code !== "23505") return { error: "Sondage non créé. Réessayez." };

  after(async () => {
    const admin = createAdminClient();
    const { data: players } = await admin
      .from("members")
      .select("id, email, first_name, notify_match, member_teams!inner(team_id)")
      .eq("member_teams.team_id", match.team_id)
      .not("user_id", "is", null)
      .neq("id", member.id);
    const recipients = (players ?? [])
      .filter((p) => p.notify_match)
      .map(({ id, email, first_name }) => ({ id, email, first_name }));
    const message = matchPollMessage({
      id: match.id,
      startsAt: match.starts_at,
      teamName: (match.team as unknown as { name: string }).name,
      opponent: match.opponent,
    });
    const target = { match_id: match.id };
    const claimed = await claimNotifications(admin, "match_poll", target, recipients.map((r) => r.id));
    const channels = await notifyMembers(
      recipients.filter((r) => claimed.has(r.id)).map((recipient) => ({ recipient, message })),
    );
    await recordChannels(admin, "match_poll", target, channels);
  });

  revalidatePath("/", "layout");
  return {};
}

/** Dispo / pas dispo pour un match ; `null` retire la réponse. */
export async function answerMatchPoll(matchId: string, available: boolean | null): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };

  const supabase = await createClient();
  const { error } =
    available === null
      ? await supabase.from("match_availability").delete().eq("match_id", matchId).eq("member_id", member.id)
      : await supabase.from("match_availability").upsert(
          { match_id: matchId, member_id: member.id, available, answered_at: new Date().toISOString() },
          { onConflict: "match_id,member_id" },
        );
  if (error) return { error: "Réponse non enregistrée (match passé ?)." };
  revalidatePath("/", "layout");
  return {};
}

/** Annule un sondage de présence (capitaine ou Bureau) : les réponses sont effacées. */
export async function cancelMatchPoll(matchId: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("match_polls").delete().eq("match_id", matchId).select("match_id");
  if (error || !data?.length) return { error: "Annulation impossible." };
  revalidatePath("/", "layout");
  return {};
}
