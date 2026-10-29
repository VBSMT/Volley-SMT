import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SCHEDULE, parseSchedule, type Schedule } from "@/lib/domain/settings";

/**
 * Horaires réglés par le Bureau. Adhérents : vue schedule_settings ; service_role : app_settings.
 * Valeurs par défaut en cas d'erreur (ex. migration pas encore appliquée).
 */
export async function getSchedule(client: SupabaseClient, source: "view" | "table" = "view"): Promise<Schedule> {
  const { data, error } = await client.from(source === "view" ? "schedule_settings" : "app_settings").select("key, value");
  return error || !data ? DEFAULT_SCHEDULE : parseSchedule(data);
}
