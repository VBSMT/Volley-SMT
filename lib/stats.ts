import type { SupabaseClient } from "@supabase/supabase-js";
import { latestVictory, type StandingRow, type Victory } from "@/lib/domain/standings";
import { parisDate } from "@/lib/domain/training";

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
  // Le classement complet (jsonb) n'est lu que pour la dernière photo : le reste ne sert qu'aux courbes.
  const { data, error } = await client
    .from("standings_snapshots")
    .select("team_id, taken_on, rank, pool_size, played, won, lost, points, set_diff, point_diff")
    .eq("team_id", teamId)
    .order("taken_on");
  if (error || !data?.length) return [];
  const snaps = data.map((s) => toSnapshot({ ...s, rows: [] }));
  const last = snaps[snaps.length - 1];
  const { data: full } = await client.from("standings_snapshots").select("rows").eq("team_id", teamId).eq("taken_on", last.takenOn).maybeSingle();
  last.rows = (full?.rows as StandingRow[]) ?? [];
  return snaps;
}

/** Dernier classement connu de chaque équipe. */
export async function getLatestSnapshots(client: SupabaseClient): Promise<Map<string, Snapshot>> {
  // Photos des 7 derniers jours seulement (synchro quotidienne) : évite de relire tout l'historique.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await client
    .from("standings_snapshots")
    .select("*")
    .gte("taken_on", since)
    .order("taken_on", { ascending: false });
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

export type Celebration = Victory & {
  teamId: string;
  teamName: string;
  opponent: string | null;
  isHome: boolean | null;
};

/**
 * Victoires des équipes du club des dernières 48 h (message de félicitations éphémère sur l'accueil).
 * Calculées à partir des photos quotidiennes du classement ; l'adversaire vient du calendrier.
 */
export async function getCelebrations(client: SupabaseClient, now = new Date()): Promise<Celebration[]> {
  const today = parisDate(now.toISOString());
  const [{ data: teams }, { data: snaps }] = await Promise.all([
    client.from("teams").select("id, name, volley34_ref"),
    // Historique léger (séries) ; le classement complet seulement pour les 3 derniers jours (score du match).
    client.from("standings_snapshots").select("team_id, taken_on, won, lost, rank").order("taken_on"),
  ]);
  const since = new Date(now.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);
  const { data: recent } = await client.from("standings_snapshots").select("team_id, taken_on, rows").gte("taken_on", since);
  const rowsOf = new Map((recent ?? []).map((r) => [`${r.team_id}|${r.taken_on}`, r.rows as StandingRow[]]));
  const out: Celebration[] = [];
  for (const team of teams ?? []) {
    const own = (snaps ?? []).filter((s) => s.team_id === team.id);
    if (own.length < 2) continue;
    const isMine = (r: StandingRow) => r.code === team.volley34_ref || r.name === `SMDT/${team.name}`;
    const victory = latestVictory(
      own.map((s) => ({
        takenOn: s.taken_on,
        won: s.won,
        lost: s.lost,
        rank: s.rank,
        mine: rowsOf.get(`${s.team_id}|${s.taken_on}`)?.find(isMine) ?? null,
      })),
      today,
    );
    if (!victory) continue;
    // Match joué entre les deux photos (la synchro passe vers 6h).
    const { data: match } = await client
      .from("matches")
      .select("opponent, is_home")
      .eq("team_id", team.id)
      .gte("starts_at", `${victory.prevTakenOn}T00:00:00Z`)
      .lt("starts_at", `${victory.takenOn}T06:00:00Z`)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    out.push({ ...victory, teamId: team.id, teamName: team.name, opponent: match?.opponent ?? null, isHome: match?.is_home ?? null });
  }
  return out.sort((a, b) => b.takenOn.localeCompare(a.takenOn));
}
