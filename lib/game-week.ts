import type { SupabaseClient } from "@supabase/supabase-js";
import { type CardKind, type LegendBonus, cardKey, gamePosition } from "@/lib/domain/game";
import { type CardInfo, type Lineup, type Slot, type TeamWeek, addDays, lineupScore, simulatedWeek, teamWeek, weekStart } from "@/lib/domain/game-week";
import { parisClock } from "@/lib/domain/notifications";
import { awardTop3 } from "@/lib/game-rewards";
import type { StandingRow } from "@/lib/domain/standings";

/** Lundi de la semaine en cours (heure de Paris). */
export const currentWeek = (now = new Date()) => weekStart(parisClock(now).date);

/** Bornes (instants) d'une semaine : du lundi 0h au lundi suivant 0h, heure de Paris (à 2 h près). */
const weekRange = (week: string) => ({ from: `${addDays(week, -1)}T22:00:00Z`, to: `${addDays(week, 6)}T22:00:00Z` });

/** Matchs de la semaine (toutes équipes du club) : avertissements et verrouillage. */
export async function getWeekMatches(client: SupabaseClient, week: string) {
  const { from, to } = weekRange(week);
  const { data } = await client.from("matches").select("team_id, starts_at").gte("starts_at", from).lt("starts_at", to);
  return (data ?? []).map((m) => ({ teamId: m.team_id as string, startsAt: m.starts_at as string }));
}

/** Équipe d'un joueur pour une semaine. */
export async function getLineup(client: SupabaseClient, ownerId: string, week: string): Promise<Lineup> {
  const { data } = await client.from("game_lineups").select("slot, member_id, team_id, kind").eq("owner_id", ownerId).eq("week_start", week);
  const lineup: Lineup = {};
  for (const r of data ?? [])
    lineup[r.slot as Slot] = { memberId: r.member_id as string, teamId: (r.team_id as string | null) ?? "", kind: (r.kind as CardKind) ?? "common" };
  return lineup;
}

type Totals = Pick<StandingRow, "scores" | "setsWon" | "setsLost" | "pointsWon" | "pointsLost">;

/** Totaux de l'équipe du club dans la dernière photo du classement prise au plus tard ce jour-là. */
async function totalsAt(admin: SupabaseClient, teamId: string, code: string | null, name: string, day: string): Promise<Totals | null> {
  const { data } = await admin
    .from("standings_snapshots")
    .select("rows")
    .eq("team_id", teamId)
    .lte("taken_on", day)
    .order("taken_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rows = (data?.rows as StandingRow[] | undefined) ?? [];
  return rows.find((r) => (code && r.code === code) || r.name === name) ?? null;
}

/**
 * Calcule (ou recalcule) les points de toutes les équipes VUT d'une semaine. Les matchs de la
 * semaine apparaissent entre la photo du lundi (avant) et celle du lundi suivant (après) ; en cours
 * de semaine, la dernière photo donne des points provisoires. Idempotent.
 */
export async function computeWeek(admin: SupabaseClient, week: string): Promise<number> {
  const { data: entries } = await admin.from("game_weeks").select("owner_id").eq("week_start", week);
  if (!entries?.length) return 0;

  const { data: teams } = await admin.from("teams").select("id, name, volley34_ref");
  // Outils de test : un résultat simulé remplace le vrai pour l'équipe et la semaine.
  const { data: tests } = await admin.from("game_test_results").select("team_id, score").eq("week_start", week);
  const weeks = new Map<string, TeamWeek | null>();
  for (const t of teams ?? []) {
    const simulated = (tests ?? []).filter((r) => r.team_id === t.id).map((r) => r.score as TeamWeek["scores"][number]);
    if (simulated.length) {
      weeks.set(t.id as string, simulatedWeek(simulated));
      continue;
    }
    const before = await totalsAt(admin, t.id, t.volley34_ref, t.name, week);
    const after = await totalsAt(admin, t.id, t.volley34_ref, t.name, addDays(week, 7));
    weeks.set(t.id as string, teamWeek(before, after));
  }

  const { data: lineups } = await admin.from("game_lineups").select("owner_id, slot, member_id, team_id, kind").eq("week_start", week);
  const { data: members } = await admin.from("members").select("id, sex, position_1, position_2");
  const { data: legends } = await admin.from("game_legends").select("member_id, bonus");
  const byId = new Map((members ?? []).map((m) => [m.id as string, m]));
  const legendOf = new Map((legends ?? []).map((l) => [l.member_id as string, l.bonus as LegendBonus]));

  for (const e of entries) {
    const lineup: Lineup = {};
    const positions = new Map<string, CardInfo>();
    for (const r of (lineups ?? []).filter((l) => l.owner_id === e.owner_id)) {
      const kind = ((r.kind as CardKind) ?? "common") as CardKind;
      const pick = { memberId: r.member_id as string, teamId: (r.team_id as string | null) ?? "", kind };
      lineup[r.slot as Slot] = pick;
      const m = byId.get(pick.memberId);
      // Poste de la carte : 2ᵉ poste pour une rare, sinon le 1er (sans effet pour Capitaine/Légende).
      const position = gamePosition((kind === "rare" ? m?.position_2 : m?.position_1) as string | null) ?? "setter";
      if (m) positions.set(cardKey(pick), { position, sex: m.sex as "F" | "M", kind, legendBonus: legendOf.get(pick.memberId) ?? null });
    }
    const score = lineupScore(lineup, positions, weeks);
    await admin
      .from("game_weeks")
      .update({ total: score.total, bonus: score.bonus, detail: score.slots, computed_at: new Date().toISOString() })
      .eq("owner_id", e.owner_id)
      .eq("week_start", week);
  }
  return entries.length;
}

/** Heure (Paris) du calcul quotidien des points, après la synchro volley34 de 6h. */
const COMPUTE_HOUR = 7;

/** Tick horaire : chaque jour à 7h, points provisoires de la semaine ; le lundi, points définitifs de la précédente. */
export async function runGameScoring(admin: SupabaseClient, now: Date) {
  const clock = parisClock(now);
  if (clock.hour !== COMPUTE_HOUR) return null;
  const week = weekStart(clock.date);
  const report: Record<string, number> = { [week]: await computeWeek(admin, week) };
  if (clock.date === week) {
    // Lundi : points définitifs de la semaine passée, puis un booster pour son top 3.
    const last = addDays(week, -7);
    report[last] = await computeWeek(admin, last);
    report.top3 = await awardTop3(admin, last);
  }
  return report;
}
