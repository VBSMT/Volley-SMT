import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLineup, type Lineup, type LineupPlayer } from "@/lib/domain/lineup";

/**
 * Génère et enregistre la compo d'une séance à partir des présents du sondage.
 * Le client doit pouvoir lire les niveaux et écrire la compo : Bureau (RLS) ou service_role.
 */
export async function generateLineup(
  client: SupabaseClient,
  session: { id: string; freeCourts: number },
): Promise<Lineup & { presentCount: number }> {
  const { data: present, error } = await client
    .from("attendance")
    .select("member_id")
    .eq("session_id", session.id)
    .eq("present", true);
  if (error) throw new Error(error.message);
  const ids = (present ?? []).map((a) => a.member_id as string);

  const [{ data: members }, { data: levels }] = await Promise.all([
    client.from("members").select("id, sex, position_1, position_2").in("id", ids),
    client.from("member_levels").select("member_id, level").in("member_id", ids),
  ]);
  const levelOf = new Map((levels ?? []).map((l) => [l.member_id as string, l.level as number]));
  const players: LineupPlayer[] = (members ?? []).map((m) => ({
    id: m.id,
    sex: m.sex,
    level: levelOf.get(m.id) ?? null,
    position1: m.position_1,
    position2: m.position_2,
  }));

  const lineup = buildLineup(players, session.freeCourts);
  const { error: saveError } = await client.from("lineups").upsert(
    {
      session_id: session.id,
      generated_at: new Date().toISOString(),
      free_courts: session.freeCourts,
      teams: lineup.teams,
      warnings: lineup.warnings,
    },
    { onConflict: "session_id" },
  );
  if (saveError) throw new Error(saveError.message);
  return { ...lineup, presentCount: players.length };
}
