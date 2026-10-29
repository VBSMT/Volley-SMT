import type { Position, Sex } from "@/lib/domain/notifications";
import { createClient } from "@/lib/supabase/server";

export type ReinforcementView = {
  id: string;
  teamId: string;
  teamName: string;
  match: { startsAt: string; opponent: string; isHome: boolean; venue: string | null; city: string | null };
  position: Position | null;
  sex: Sex | null;
  note: string | null;
  createdAt: string;
  myOffer: boolean;
  /** Volontaires par ordre chronologique — visibles seulement par le capitaine et le Bureau. */
  offers: { memberId: string; name: string; at: string }[] | null;
  canManage: boolean;
};

/** Demandes de renfort ouvertes pour des matchs à venir. Vide si la migration n'est pas encore appliquée. */
export async function getOpenReinforcements(viewer: {
  memberId: string;
  isBoard: boolean;
  captainTeamIds: string[];
}): Promise<ReinforcementView[]> {
  const supabase = await createClient();
  const { data: requests, error } = await supabase
    .from("reinforcement_requests")
    .select(
      `id, team_id, position, sex, note, created_at,
       team:teams(name),
       match:matches!inner(starts_at, opponent, is_home, venue, city)`,
    )
    .eq("status", "open")
    .gt("match.starts_at", new Date().toISOString())
    .order("created_at");
  if (error || !requests?.length) return [];

  const ids = requests.map((r) => r.id as string);
  const [{ data: offers }, { data: directory }] = await Promise.all([
    supabase.from("reinforcement_offers").select("request_id, member_id, created_at").in("request_id", ids).order("created_at"),
    supabase.from("member_directory").select("id, first_name, last_name"),
  ]);
  const names = new Map((directory ?? []).map((m) => [m.id as string, `${m.first_name} ${m.last_name}`]));

  return requests
    .map((r) => {
      const match = r.match as unknown as { starts_at: string; opponent: string; is_home: boolean; venue: string | null; city: string | null };
      const canManage = viewer.isBoard || viewer.captainTeamIds.includes(r.team_id);
      const own = (offers ?? []).filter((o) => o.request_id === r.id);
      return {
        id: r.id,
        teamId: r.team_id,
        teamName: (r.team as unknown as { name: string } | null)?.name ?? "",
        match: { startsAt: match.starts_at, opponent: match.opponent, isHome: match.is_home, venue: match.venue, city: match.city },
        position: r.position,
        sex: r.sex,
        note: r.note,
        createdAt: r.created_at,
        myOffer: own.some((o) => o.member_id === viewer.memberId),
        offers: canManage
          ? own.map((o) => ({ memberId: o.member_id, name: names.get(o.member_id) ?? "Adhérent", at: o.created_at }))
          : null,
        canManage,
      };
    })
    .sort((a, b) => a.match.startsAt.localeCompare(b.match.startsAt));
}
