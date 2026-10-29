import type { SupabaseClient } from "@supabase/supabase-js";
import type { StandingRow } from "@/lib/domain/standings";

export type Snapshot = {
  teamId: string;
  takenOn: string;
  rows: StandingRow[];
  rank: number;
  poolSize: number;
  played: number;
  won: number;
  lost: number;
  points: number;
  setDiff: number;
  pointDiff: number;
};

const toSnapshot = (s: Record<string, unknown>): Snapshot => ({
  teamId: s.team_id as string,
  takenOn: s.taken_on as string,
  rows: s.rows as StandingRow[],
  rank: s.rank as number,
  poolSize: s.pool_size as number,
  played: s.played as number,
  won: s.won as number,
  lost: s.lost as number,
  points: s.points as number,
  setDiff: s.set_diff as number,
  pointDiff: s.point_diff as number,
});

/** Historique des classements d'une équipe (du plus ancien au plus récent). Vide avant migration. */
export async function getTeamSnapshots(client: SupabaseClient, teamId: string): Promise<Snapshot[]> {
  const { data, error } = await client.from("standings_snapshots").select("*").eq("team_id", teamId).order("taken_on");
  return error ? [] : (data ?? []).map(toSnapshot);
}

/** Dernier classement connu de chaque équipe. */
export async function getLatestSnapshots(client: SupabaseClient): Promise<Map<string, Snapshot>> {
  const { data, error } = await client.from("standings_snapshots").select("*").order("taken_on", { ascending: false }).limit(400);
  const latest = new Map<string, Snapshot>();
  if (error) return latest;
  for (const s of data ?? []) if (!latest.has(s.team_id)) latest.set(s.team_id, toSnapshot(s));
  return latest;
}

export type SeasonProgress = { total: number; played: number; home: number; away: number; next: { id: string; startsAt: string; opponent: string; isHome: boolean } | null };

/** Avancement de la saison à partir du calendrier (matchs passés / à venir). */
export async function getSeasonProgress(client: SupabaseClient, teamIds: string[]): Promise<Map<string, SeasonProgress>> {
  const { data } = await client.from("matches").select("id, team_id, starts_at, opponent, is_home").in("team_id", teamIds).order("starts_at");
  const now = Date.now();
  const byTeam = new Map<string, SeasonProgress>(teamIds.map((id) => [id, { total: 0, played: 0, home: 0, away: 0, next: null }]));
  for (const m of data ?? []) {
    const p = byTeam.get(m.team_id)!;
    p.total++;
    if (m.is_home) p.home++;
    else p.away++;
    if (Date.parse(m.starts_at) < now) p.played++;
    else if (!p.next) p.next = { id: m.id, startsAt: m.starts_at, opponent: m.opponent, isHome: m.is_home };
  }
  return byTeam;
}
