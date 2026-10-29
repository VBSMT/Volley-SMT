import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
export type LogTarget = { session_id: string } | { match_id: string } | { reinforcement_id: string };

const conflictKey = (target: LogTarget) => `kind,${Object.keys(target)[0]},member_id`;

/**
 * Réserve les envois dans le journal (un par type, cible et personne) :
 * renvoie seulement les personnes nouvellement réservées, donc jamais de double envoi.
 */
export async function claimNotifications(admin: Admin, kind: string, target: LogTarget, memberIds: string[]) {
  if (!memberIds.length) return new Set<string>();
  const { data, error } = await admin
    .from("notification_log")
    .upsert(
      memberIds.map((member_id) => ({ kind, ...target, member_id })),
      { onConflict: conflictKey(target), ignoreDuplicates: true },
    )
    .select("member_id");
  if (error) throw new Error(`Journal des notifications : ${error.message}`);
  return new Set((data ?? []).map((r) => r.member_id as string));
}

export async function recordChannels(admin: Admin, kind: string, target: LogTarget, channels: Map<string, string>) {
  await Promise.all(
    [...channels].map(([member_id, channel]) =>
      admin.from("notification_log").update({ channel }).match({ kind, ...target, member_id }),
    ),
  );
}
