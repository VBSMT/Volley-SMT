import { shortName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type MatchPollView = {
  matchId: string;
  launched: boolean;
  available: { id: string; name: string }[];
  unavailable: { id: string; name: string }[];
  /** Joueurs de l'équipe sans réponse — affiché au capitaine et au Bureau. */
  pending: { id: string; name: string }[] | null;
  myAnswer: boolean | null;
};

/**
 * Sondage de présence d'un match (lecture soumise à la RLS : équipe, capitaine, Bureau).
 * Renvoie null si l'adhérent n'y a pas accès ou si la migration n'est pas appliquée.
 */
export async function getMatchPoll(
  match: { id: string; teamId: string },
  viewer: { memberId: string; canManage: boolean },
): Promise<MatchPollView | null> {
  const supabase = await createClient();
  const [{ data: poll, error }, { data: answers }, { data: team }] = await Promise.all([
    supabase.from("match_polls").select("match_id").eq("match_id", match.id).maybeSingle(),
    supabase.from("match_availability").select("member_id, available, answered_at").eq("match_id", match.id).order("answered_at"),
    supabase.from("team_roster").select("member_id, first_name, last_name").eq("team_id", match.teamId),
  ]);
  if (error) return null;

  const names = new Map((team ?? []).map((m) => [m.member_id as string, shortName(m.first_name, m.last_name)]));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr");
  const list = (available: boolean) =>
    (answers ?? [])
      .filter((a) => a.available === available)
      .map((a) => ({ id: a.member_id as string, name: names.get(a.member_id) ?? "Adhérent" }))
      .sort(byName);
  const answered = new Set((answers ?? []).map((a) => a.member_id));

  return {
    matchId: match.id,
    launched: !!poll,
    available: list(true),
    unavailable: list(false),
    pending: viewer.canManage
      ? [...names].filter(([id]) => !answered.has(id)).map(([id, name]) => ({ id, name })).sort(byName)
      : null,
    myAnswer: (answers ?? []).find((a) => a.member_id === viewer.memberId)?.available ?? null,
  };
}
