import type { SupabaseClient } from "@supabase/supabase-js";

export type Season = { id: string; label: string; startsOn: string; endsOn: string };

/** Saison en cours (sinon la plus récente). */
export async function getCurrentSeason(client: SupabaseClient): Promise<Season | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await client.from("seasons").select("id, label, starts_on, ends_on").order("starts_on", { ascending: false });
  const s = (data ?? []).find((x) => x.starts_on <= today && today <= x.ends_on) ?? data?.[0];
  return s ? { id: s.id, label: s.label, startsOn: s.starts_on, endsOn: s.ends_on } : null;
}

/**
 * Champs à mettre à jour quand la cotisation change : une cotisation réglée prolonge
 * l'adhésion jusqu'à la fin de la saison (date utilisée par la purge RGPD).
 */
export function duesFields(paid: boolean, season: Season | null) {
  return paid && season ? { dues_paid: true, last_membership_ends_on: season.endsOn } : { dues_paid: paid };
}
