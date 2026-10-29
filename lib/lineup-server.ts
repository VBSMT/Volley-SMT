import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLineup, manualLineup, type Lineup, type LineupPlayer } from "@/lib/domain/lineup";

/**
 * Génère et enregistre la compo d'une séance à partir des présents du sondage.
 * Le client doit pouvoir lire les niveaux et écrire la compo : Bureau (RLS) ou service_role.
 */
export async function generateLineup(
  client: SupabaseClient,
  session: { id: string; freeCourts: number },
  /** Nombre d'équipes fixé par le Bureau ; non précisé = on garde celui déjà fixé (ou automatique). */
  forcedTeams?: number | null,
): Promise<Lineup & { presentCount: number }> {
  if (forcedTeams === undefined) {
    const { data } = await client.from("lineups").select("forced_teams").eq("session_id", session.id).maybeSingle();
    forcedTeams = (data?.forced_teams as number | null) ?? null;
  }
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

  const lineup = buildLineup(players, session.freeCourts, forcedTeams);
  const { error: saveError } = await client.from("lineups").upsert(
    {
      session_id: session.id,
      generated_at: new Date().toISOString(),
      free_courts: session.freeCourts,
      forced_teams: forcedTeams,
      teams: lineup.teams,
      warnings: lineup.warnings,
    },
    { onConflict: "session_id" },
  );
  if (saveError) throw new Error(saveError.message);
  return { ...lineup, presentCount: players.length };
}

/**
 * Enregistre une compo réorganisée à la main (Bureau) : mêmes joueurs, autre répartition.
 * Totaux et alertes recalculés ; aucun joueur ajouté ni retiré ici.
 */
export async function saveManualLineup(client: SupabaseClient, sessionId: string, teamIds: string[][]) {
  const { data: current, error } = await client.from("lineups").select("teams").eq("session_id", sessionId).maybeSingle();
  if (error || !current) throw new Error("Compo introuvable.");
  const before = (current.teams as { players: string[] }[]).flatMap((t) => t.players).sort();
  const after = teamIds.flat().sort();
  if (before.length !== after.length || before.some((id, i) => id !== after[i])) {
    throw new Error("La compo a changé entre-temps : rechargez la page.");
  }

  const [{ data: members }, { data: levels }] = await Promise.all([
    client.from("members").select("id, sex, position_1, position_2").in("id", after),
    client.from("member_levels").select("member_id, level").in("member_id", after),
  ]);
  const levelOf = new Map((levels ?? []).map((l) => [l.member_id as string, l.level as number]));
  const byId = new Map(
    (members ?? []).map((m) => [
      m.id as string,
      { id: m.id, sex: m.sex, level: levelOf.get(m.id) ?? null, position1: m.position_1, position2: m.position_2 } as LineupPlayer,
    ]),
  );
  const lineup = manualLineup(teamIds.map((t) => t.map((id) => byId.get(id)!).filter(Boolean)));
  const { error: saveError } = await client
    .from("lineups")
    .update({ teams: lineup.teams, warnings: lineup.warnings, generated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
  if (saveError) throw new Error(saveError.message);
}
