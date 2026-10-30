import type { SupabaseClient } from "@supabase/supabase-js";
import { type CardKind, type GameCard, type FormState, type LegendBonus, cardKey, gamePosition, nextForm } from "@/lib/domain/game";
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

export type CollectionEntry = { card: GameCard; copies: number };

/** Collection de l'adhérent connecté (cartes à jour : note, poste, photo). */
export async function getCollection(client: SupabaseClient, cards: GameCard[]): Promise<CollectionEntry[]> {
  const { data } = await client.from("game_collection").select("member_id, team_id, kind, copies");
  const byKey = new Map(cards.map((c) => [cardKey(c), c]));
  return (data ?? []).flatMap((r) => {
    const card = byKey.get(cardKey({ memberId: r.member_id as string, teamId: (r.team_id as string | null) ?? "", kind: r.kind as CardKind }));
    return card ? [{ card, copies: r.copies as number }] : [];
  });
}

/** Le booster de départ a-t-il été ouvert ? */
export async function starterOpened(client: SupabaseClient, memberId: string): Promise<boolean> {
  const { data } = await client.from("game_boosters").select("opened_at").eq("owner_id", memberId).eq("kind", "starter").maybeSingle();
  return !!data?.opened_at;
}

/** Synchro volley34 : met à jour la note de forme d'une équipe après une photo du classement. */
export async function updateTeamForm(admin: SupabaseClient, teamId: string, scores: StandingRow["scores"]) {
  const { data } = await admin.from("game_team_form").select("recent, last_scores, rating, best_rating").eq("team_id", teamId).maybeSingle();
  const prev: FormState | null = data
    ? { recent: data.recent as number[], lastScores: data.last_scores as FormState["lastScores"], rating: data.rating as number, bestRating: data.best_rating as number }
    : null;
  const next = nextForm(prev, scores);
  await admin.from("game_team_form").upsert({
    team_id: teamId,
    recent: next.recent,
    last_scores: next.lastScores,
    rating: next.rating,
    best_rating: next.bestRating,
    updated_at: new Date().toISOString(),
  });
}
