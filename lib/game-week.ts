import type { SupabaseClient } from "@supabase/supabase-js";
import { type CardKind, type LegendBonus, cardKey, gamePosition } from "@/lib/domain/game";
import { type CardInfo, type Lineup, type MatchResult, matchdays, type Slot, type TeamWeek, addDays, lineupScore, simulatedWeek, weekFromResults, weekIsFinal, weekStart } from "@/lib/domain/game-week";
import { parisClock } from "@/lib/domain/notifications";
import { awardTop3 } from "@/lib/game-rewards";

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

export type Fixture = { id: string; teamId: string; teamName: string; opponent: string; isHome: boolean; startsAt: string };

/** Matchs de la semaine avec équipe et adversaire (feuille « Matchs de la journée »). */
export async function getWeekFixtures(client: SupabaseClient, week: string): Promise<Fixture[]> {
  const { from, to } = weekRange(week);
  const { data } = await client
    .from("matches")
    .select("id, team_id, opponent, is_home, starts_at, team:teams(name)")
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at");
  return (data ?? []).map((m) => ({
    id: m.id as string,
    teamId: m.team_id as string,
    teamName: (m.team as unknown as { name: string } | null)?.name ?? "",
    opponent: m.opponent as string,
    isHome: m.is_home as boolean,
    startsAt: m.starts_at as string,
  }));
}

/** Journées de la saison : semaines ayant au moins un match d'une équipe du club. */
export async function getMatchdays(client: SupabaseClient, season: { startsOn: string; endsOn: string } | null): Promise<string[]> {
  let q = client.from("matches").select("starts_at");
  if (season) q = q.gte("starts_at", `${season.startsOn}T00:00:00Z`).lte("starts_at", `${season.endsOn}T23:59:59Z`);
  const { data } = await q;
  return matchdays((data ?? []).map((m) => m.starts_at as string));
}

/** Équipe d'un joueur pour une semaine. */
export async function getLineup(client: SupabaseClient, ownerId: string, week: string): Promise<Lineup> {
  const { data } = await client.from("game_lineups").select("slot, member_id, team_id, kind, position").eq("owner_id", ownerId).eq("week_start", week);
  const lineup: Lineup = {};
  for (const r of data ?? [])
    lineup[r.slot as Slot] = {
      memberId: r.member_id as string,
      teamId: (r.team_id as string | null) ?? "",
      kind: (r.kind as CardKind) ?? "common",
      position: gamePosition(r.position as string | null) ?? undefined,
    };
  return lineup;
}

/**
 * Calcule (ou recalcule) les points de toutes les équipes VUT d'une semaine, d'après les résultats
 * datés des matchs (`game_team_results`, rattachés à la date du match même s'ils sont publiés en
 * retard). Tant qu'un match joué de la semaine n'a pas de résultat, la semaine reste provisoire
 * (équipes listées dans `pending`) ; elle devient définitive une fois complète, ou 14 jours après
 * sa fin. Idempotent. Renvoie le nombre de joueurs et si la semaine est définitive.
 */
export async function computeWeek(admin: SupabaseClient, week: string, now = new Date()): Promise<{ players: number; final: boolean }> {
  const { data: entries } = await admin.from("game_weeks").select("owner_id").eq("week_start", week);
  const { from, to } = weekRange(week);

  const { data: teams } = await admin.from("teams").select("id, name");
  // Outils de test : un résultat simulé remplace le vrai pour l'équipe et la semaine.
  const { data: tests } = await admin.from("game_test_results").select("team_id, score").eq("week_start", week);
  const { data: results } = await admin.from("game_team_results").select("*").gte("played_at", from).lt("played_at", to);
  const { data: played } = await admin.from("matches").select("id, team_id, starts_at").gte("starts_at", from).lt("starts_at", to).lt("starts_at", now.toISOString());
  const withResult = new Set((results ?? []).map((r) => r.match_id as string | null).filter(Boolean));

  const weeks = new Map<string, TeamWeek | null>();
  const pending: string[] = [];
  for (const t of teams ?? []) {
    const simulated = (tests ?? []).filter((r) => r.team_id === t.id).map((r) => r.score as TeamWeek["scores"][number]);
    if (simulated.length) {
      weeks.set(t.id as string, simulatedWeek(simulated));
      continue;
    }
    const mine: MatchResult[] = (results ?? [])
      .filter((r) => r.team_id === t.id)
      .map((r) => ({
        matchId: r.match_id as string | null,
        playedAt: r.played_at as string,
        score: r.score as MatchResult["score"],
        setsWon: r.sets_won as number,
        setsLost: r.sets_lost as number,
        pointsWon: r.points_won as number,
        pointsLost: r.points_lost as number,
      }));
    weeks.set(t.id as string, weekFromResults(mine));
    if ((played ?? []).some((m) => m.team_id === t.id && !withResult.has(m.id as string))) pending.push(t.name as string);
  }
  const final = weekIsFinal(week, pending.length, parisClock(now).date);
  if (!entries?.length) return { players: 0, final };

  const { data: lineups } = await admin.from("game_lineups").select("owner_id, slot, member_id, team_id, kind, position").eq("week_start", week);
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
      // Poste figé à la validation ; sinon (anciennes compos) poste actuel : 2ᵉ pour une rare, 1er sinon.
      const position =
        gamePosition(r.position as string | null) ?? gamePosition((kind === "rare" ? m?.position_2 : m?.position_1) as string | null) ?? "setter";
      if (m) positions.set(cardKey(pick), { position, sex: m.sex as "F" | "M", kind, legendBonus: legendOf.get(pick.memberId) ?? null });
    }
    const score = lineupScore(lineup, positions, weeks);
    await admin
      .from("game_weeks")
      .update({ total: score.total, bonus: score.bonus, detail: score.slots, computed_at: new Date().toISOString(), final, pending })
      .eq("owner_id", e.owner_id)
      .eq("week_start", week);
  }
  return { players: entries.length, final };
}

/** Heure (Paris) du calcul quotidien des points, après la synchro volley34 de 6h. */
const COMPUTE_HOUR = 7;

/**
 * Tick horaire, chaque jour à 7h (après la synchro de 6h) : points de la semaine en cours et de
 * toutes les semaines encore provisoires (résultats publiés en retard) ; quand une semaine devient
 * définitive, son top 3 reçoit son booster (une seule fois).
 */
export async function runGameScoring(admin: SupabaseClient, now: Date) {
  const clock = parisClock(now);
  if (clock.hour !== COMPUTE_HOUR) return null;
  const current = weekStart(clock.date);
  const oldest = addDays(current, -7 * 4); // au-delà, les semaines sont forcément figées (14 jours)
  const { data: open } = await admin.from("game_weeks").select("week_start").eq("final", false).gte("week_start", oldest).lt("week_start", current);
  const weeks = [...new Set([current, ...(open ?? []).map((w) => w.week_start as string)])];
  const report: Record<string, unknown> = {};
  for (const week of weeks) {
    const r = await computeWeek(admin, week, now);
    report[week] = r;
    if (r.final) report[`top3:${week}`] = await awardTop3(admin, week);
  }
  return report;
}
