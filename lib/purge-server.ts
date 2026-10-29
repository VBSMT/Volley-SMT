import "server-only";
import { parisClock } from "@/lib/domain/notifications";
import { memberPurgeCutoff } from "@/lib/domain/purge";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Heure (Paris) de la purge quotidienne ; idempotente, donc sans risque si relancée. */
const PURGE_HOUR = 3;

export function isPurgeDue(now: Date) {
  return parisClock(now).hour === PURGE_HOUR;
}

/** Purge RGPD : niveaux des adhésions terminées, fiches et comptes 2 ans après la dernière adhésion. */
export async function runPurge(admin: Admin, now: Date) {
  const today = parisClock(now).date;

  const { data: ended } = await admin.from("members").select("id").lt("last_membership_ends_on", today);
  const endedIds = (ended ?? []).map((m) => m.id as string);
  let levels = 0;
  if (endedIds.length) {
    const { count } = await admin.from("member_levels").delete({ count: "exact" }).in("member_id", endedIds);
    levels = count ?? 0;
  }

  const { data: old } = await admin
    .from("members")
    .select("id, user_id")
    .lt("last_membership_ends_on", memberPurgeCutoff(today));
  const errors: string[] = [];
  for (const m of old ?? []) {
    if (m.user_id) {
      const { error } = await admin.auth.admin.deleteUser(m.user_id as string);
      if (error) {
        errors.push(error.message);
        continue;
      }
    }
    const { error } = await admin.from("members").delete().eq("id", m.id);
    if (error) errors.push(error.message);
  }
  return { levels, members: (old ?? []).length - errors.length, errors };
}
