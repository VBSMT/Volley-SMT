import type { SupabaseClient } from "@supabase/supabase-js";
import { type CardKind, type GameCard, type FormState, type LegendBonus, cardKey, gamePosition, nextForm } from "@/lib/domain/game";
import { attributeResults } from "@/lib/domain/game-week";
import type { StandingRow } from "@/lib/domain/standings";

const toCard = (r: Record<string, unknown>): GameCard | null => {
  const position = gamePosition(r.position as string | null);
  if (!position) return null;
  return {
    memberId: r.member_id as string,
    teamId: (r.team_id as string | null) ?? "",
    kind: (r.kind as CardKind) ?? "common",
    legendBonus: (r.legend_bonus as LegendBonus | null) ?? null,
    isDev: !!r.is_dev,
    teamName: r.team_name as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    sex: r.sex as "F" | "M",
    position,
    rating: r.rating as number,
    bestRating: r.best_rating as number,
    photoVersion: r.photo_updated_at ? String(Date.parse(r.photo_updated_at as string)) : null,
  };
};

/** Toutes les cartes du club (vue `game_cards`, adhérents connectés). */
export async function getGameCards(client: SupabaseClient): Promise<GameCard[]> {
  const { data } = await client.from("game_cards").select("*");
  return (data ?? []).map(toCard).filter((c): c is GameCard => !!c);
}

export type CollectionEntry = { card: GameCard; copies: number; gifted?: boolean };

/** Collection de l'adhérent connecté (cartes à jour : note, poste, photo). */
export async function getCollection(client: SupabaseClient, cards: GameCard[]): Promise<CollectionEntry[]> {
  const { data } = await client.from("game_collection").select("member_id, team_id, kind, copies, gifted");
  const byKey = new Map(cards.map((c) => [cardKey(c), c]));
  return (data ?? []).flatMap((r) => {
    const card = byKey.get(cardKey({ memberId: r.member_id as string, teamId: (r.team_id as string | null) ?? "", kind: r.kind as CardKind }));
    return card ? [{ card, copies: r.copies as number, gifted: !!r.gifted }] : [];
  });
}

/** Le booster de départ a-t-il été ouvert ? */
export async function starterOpened(client: SupabaseClient, memberId: string): Promise<boolean> {
  const { data } = await client.from("game_boosters").select("opened_at").eq("owner_id", memberId).eq("kind", "starter").maybeSingle();
  return !!data?.opened_at;
}

type Totals = Pick<StandingRow, "scores" | "setsWon" | "setsLost" | "pointsWon" | "pointsLost">;

/**
 * Synchro volley34, après chaque photo du classement : note de forme de l'équipe, et nouveaux
 * résultats rattachés aux matchs joués sans résultat (le plus ancien d'abord), pour qu'un score
 * publié en retard compte dans la semaine du match.
 */
export async function updateTeamForm(admin: SupabaseClient, teamId: string, mine: Totals, photoDate: string) {
  const { data } = await admin
    .from("game_team_form")
    .select("recent, last_scores, last_totals, rating, best_rating")
    .eq("team_id", teamId)
    .maybeSingle();
  const prev: FormState | null = data
    ? { recent: data.recent as number[], lastScores: data.last_scores as FormState["lastScores"], rating: data.rating as number, bestRating: data.best_rating as number }
    : null;
  const next = nextForm(prev, mine.scores);

  const before = previousTotals(prev?.lastScores ?? null, data?.last_totals as Omit<Totals, "scores"> | null, mine);
  const { data: done } = await admin.from("game_team_results").select("match_id").eq("team_id", teamId).not("match_id", "is", null);
  const resolved = new Set((done ?? []).map((r) => r.match_id as string));
  const { data: played } = await admin.from("matches").select("id, starts_at").eq("team_id", teamId).lt("starts_at", new Date().toISOString());
  const unresolved = (played ?? []).filter((m) => !resolved.has(m.id as string)).map((m) => ({ id: m.id as string, startsAt: m.starts_at as string }));
  const results = attributeResults(before, mine, unresolved, photoDate);
  if (results.length) {
    await admin.from("game_team_results").insert(
      results.map((r) => ({
        team_id: teamId,
        match_id: r.matchId,
        played_at: r.playedAt,
        score: r.score,
        sets_won: r.setsWon,
        sets_lost: r.setsLost,
        points_won: r.pointsWon,
        points_lost: r.pointsLost,
      })),
    );
  }

  await admin.from("game_team_form").upsert({
    team_id: teamId,
    recent: next.recent,
    last_scores: next.lastScores,
    last_totals: { setsWon: mine.setsWon, setsLost: mine.setsLost, pointsWon: mine.pointsWon, pointsLost: mine.pointsLost },
    rating: next.rating,
    best_rating: next.bestRating,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Totaux de la photo précédente. Avant cette version, seuls les compteurs de scores étaient
 * gardés : sets déduits des scores, points estimés au prorata des sets.
 */
function previousTotals(lastScores: Totals["scores"] | null, lastTotals: Omit<Totals, "scores"> | null, now: Totals): Totals | null {
  if (!lastScores) return null;
  if (lastTotals) return { scores: lastScores, ...lastTotals };
  const SETS: Record<string, [number, number]> = { s30: [3, 0], s31: [3, 1], s32: [3, 2], s23: [2, 3], s13: [1, 3], s03: [0, 3], fWon: [3, 0], fLost: [0, 3] };
  let setsWon = 0;
  let setsLost = 0;
  for (const [k, n] of Object.entries(lastScores)) {
    setsWon += SETS[k][0] * (n as number);
    setsLost += SETS[k][1] * (n as number);
  }
  const ratio = now.setsWon + now.setsLost ? (setsWon + setsLost) / (now.setsWon + now.setsLost) : 0;
  return { scores: lastScores, setsWon, setsLost, pointsWon: Math.round(now.pointsWon * ratio), pointsLost: Math.round(now.pointsLost * ratio) };
}
