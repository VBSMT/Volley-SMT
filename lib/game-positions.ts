import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_POSITION_LABELS, gamePosition } from "@/lib/domain/game";
import { isLocked } from "@/lib/domain/game-week";
import { shortName } from "@/lib/format";
import { currentWeek, getWeekMatches } from "@/lib/game-week";
import { gamePlayers } from "@/lib/game-rewards";
import { notifyMembers } from "@/lib/notify";

/**
 * Un joueur a changé de poste : les joueurs VUT qui l'ont validé dans une compo de la journée en cours
 * ou à venir, avant le match de son équipe, sont prévenus (il compte avec son poste figé ; à eux de le
 * garder ou de le remplacer). Une notification par joueur prévenu.
 */
export async function notifyPositionChange(admin: SupabaseClient, memberId: string, now = new Date()) {
  const { data: m } = await admin.from("members").select("first_name, last_name, position_1, position_2").eq("id", memberId).maybeSingle();
  if (!m) return 0;
  const { data: rows } = await admin
    .from("game_lineups")
    .select("owner_id, week_start, team_id, kind, position")
    .eq("member_id", memberId)
    .in("kind", ["common", "rare"])
    .not("position", "is", null)
    .gte("week_start", currentWeek(now));
  const players = new Set(await gamePlayers(admin));
  const weeks = new Map<string, Awaited<ReturnType<typeof getWeekMatches>>>();
  const owners = new Map<string, string>(); // joueur prévenu → poste figé
  for (const r of rows ?? []) {
    const current = gamePosition((r.kind === "rare" ? m.position_2 : m.position_1) as string | null);
    if (current === r.position || !players.has(r.owner_id as string)) continue;
    const week = r.week_start as string;
    if (!weeks.has(week)) weeks.set(week, await getWeekMatches(admin, week));
    if (isLocked((r.team_id as string | null) ?? "", weeks.get(week)!, now)) continue;
    owners.set(r.owner_id as string, r.position as string);
  }
  if (!owners.size) return 0;
  const { data: people } = await admin.from("members").select("id, email, first_name").in("id", [...owners.keys()]);
  const name = shortName(m.first_name as string, m.last_name as string);
  await notifyMembers(
    (people ?? []).map((p) => {
      const from = gamePosition(owners.get(p.id as string) ?? null);
      return {
        recipient: { id: p.id as string, email: p.email as string, first_name: p.first_name as string },
        message: {
          title: `⚠️ VUT : ${name} a changé de poste`,
          body: `Il compte comme ${from ? GAME_POSITION_LABELS[from] : "avant"} dans ta compo. Tu peux le garder ou le remplacer avant son match.`,
          url: "/jeu",
        },
      };
    }),
  ).catch(() => {});
  return owners.size;
}
