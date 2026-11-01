import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rank, weekStart } from "@/lib/domain/game-week";
import { TOP_REWARDED, dailyState, rewardReason, trainingRewardsDue } from "@/lib/domain/game-rewards";
import { parisClock } from "@/lib/domain/notifications";
import { notifyMembers } from "@/lib/notify";

/** Joueurs de VUT : le Bureau pour l'instant (phase de test). */
export async function gamePlayers(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin.from("member_roles").select("member_id").eq("role", "board");
  return [...new Set((data ?? []).map((r) => r.member_id as string))];
}

/**
 * Donne un booster pour une récompense (une seule fois par raison, grâce à l'index unique) et
 * prévient le joueur par push. Renvoie true si le booster est nouveau.
 */
export async function awardBooster(admin: SupabaseClient, ownerId: string, reason: string, label: string): Promise<boolean> {
  // Insertion simple : l'index unique partiel refuse une récompense déjà donnée (code 23505).
  const { data, error } = await admin.from("game_boosters").insert({ owner_id: ownerId, kind: "earned", reason }).select("id");
  if (error || !data?.length) return false;
  const { data: m } = await admin.from("members").select("id, email, first_name, notify_game").eq("id", ownerId).maybeSingle();
  // Préférence « Jeu VUT » coupée : le booster est donné, sans notification.
  if (m && m.notify_game !== false) {
    await notifyMembers([
      {
        recipient: { id: m.id as string, email: m.email as string, first_name: m.first_name as string },
        message: { title: "🎁 Nouveau booster VUT", body: label, url: "/jeu?vue=boosters" },
      },
    ]).catch(() => {});
  }
  return true;
}

/** Top 3 d'une semaine terminée : un booster chacun (points définitifs calculés juste avant). */
export async function awardTop3(admin: SupabaseClient, week: string): Promise<number> {
  const { data } = await admin.from("game_weeks").select("owner_id, total, bonus, validated_at").eq("week_start", week);
  const ranked = rank((data ?? []).map((r) => ({ ownerId: r.owner_id as string, total: Number(r.total), bonus: Number(r.bonus), validatedAt: r.validated_at as string })));
  let n = 0;
  for (const e of ranked.slice(0, TOP_REWARDED)) {
    if (e.total <= 0) continue;
    if (await awardBooster(admin, e.ownerId, rewardReason.top3(week), `Top ${e.rank} de la semaine : bravo !`)) n++;
  }
  return n;
}

/** Heure (Paris) des récompenses d'entraînement et d'événement : fin des entraînements. */
const REWARD_HOUR = 22;

/**
 * Tick horaire, à 22h : un booster tous les 3 entraînements passés auxquels on a répondu au
 * sondage (compteur remis à zéro à chaque booster), et un par événement où l'on est venu.
 */
export async function runGameRewards(admin: SupabaseClient, now: Date) {
  if (parisClock(now).hour !== REWARD_HOUR) return null;
  const players = await gamePlayers(admin);
  if (!players.length) return { trainings: 0, events: 0 };
  const nowIso = now.toISOString();

  const { data: answers } = await admin
    .from("attendance")
    .select("member_id, training_sessions!inner(ends_at)")
    .in("member_id", players)
    .lt("training_sessions.ends_at", nowIso);
  const { data: given } = await admin.from("game_boosters").select("owner_id, reason").in("owner_id", players).like("reason", "training:%");
  let trainings = 0;
  for (const id of players) {
    const answered = (answers ?? []).filter((a) => a.member_id === id).length;
    const already = (given ?? []).filter((g) => g.owner_id === id).length;
    for (const k of trainingRewardsDue(answered, already)) {
      if (await awardBooster(admin, id, rewardReason.training(k), "3 entraînements répondus : un booster pour toi !")) trainings++;
    }
  }

  // Compos validées à l'avance : leur booster arrive pendant la semaine concernée.
  const week = weekStart(parisClock(now).date);
  const { data: validated } = await admin.from("game_weeks").select("owner_id").eq("week_start", week).in("owner_id", players);
  let weeks = 0;
  for (const v of validated ?? []) {
    if (await awardBooster(admin, v.owner_id as string, rewardReason.week(week), "Équipe de la semaine validée : un booster pour toi !")) weeks++;
  }

  const { data: events } = await admin
    .from("event_attendance")
    .select("member_id, event_id, events!inner(title, starts_at)")
    .in("member_id", players)
    .eq("coming", true)
    .lt("events.starts_at", nowIso);
  let evts = 0;
  for (const e of events ?? []) {
    const title = (e.events as unknown as { title: string }).title;
    if (await awardBooster(admin, e.member_id as string, rewardReason.event(e.event_id as string), `Merci d'être venu·e : ${title}`)) evts++;
  }
  return { trainings, events: evts, weeks };
}

/**
 * Début d'une nouvelle saison : les collections repartent de zéro (boosters, cartes, équipes,
 * éclats). L'historique des points (`game_weeks`) reste, filtré par saison. Une fois par jour (3h).
 */
/**
 * Purge de nuit : boosters du jour et de série ouverts depuis plus de 30 jours supprimés ; pour les
 * autres boosters ouverts, la liste des cartes tirées est effacée (la raison reste, elle évite qu'une
 * récompense soit redonnée). Les cartes obtenues restent dans les collections.
 */
export async function purgeOldBoosters(admin: SupabaseClient, now: Date) {
  const before = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const { count: deleted } = await admin
    .from("game_boosters")
    .delete({ count: "exact" })
    .lt("opened_at", before)
    .or("reason.like.daily:%,reason.like.streak:%,reason.eq.test");
  await admin.from("game_boosters").update({ cards: null }).lt("opened_at", before).not("cards", "is", null);
  // Marché : annonces de plus de 30 jours (et leurs offres) effacées.
  await admin.from("game_listings").delete().lt("created_at", before);
  return deleted ?? 0;
}

export async function resetGameIfSeasonStarts(admin: SupabaseClient, now: Date) {
  const clock = parisClock(now);
  if (clock.hour !== 3) return null;
  const { data: season } = await admin.from("seasons").select("id").eq("starts_on", clock.date).maybeSingle();
  if (!season) return null;
  const none = "00000000-0000-0000-0000-000000000000";
  for (const table of ["game_listings", "game_lineups", "game_collection", "game_boosters", "game_wallet"]) {
    await admin.from(table).delete().neq(table === "game_listings" ? "seller_id" : "owner_id", none);
  }
  return { reset: true };
}

/** Booster du jour : jours déjà récupérés (15 derniers jours suffisent pour une série de 7). */
export async function getDailyState(client: SupabaseClient, ownerId: string, now = new Date()) {
  const since = new Date(now.getTime() - 15 * 86_400_000).toISOString();
  const { data } = await client.from("game_boosters").select("reason").eq("owner_id", ownerId).like("reason", "daily:%").gte("created_at", since);
  return dailyState((data ?? []).map((r) => (r.reason as string).slice("daily:".length)), parisClock(now).date);
}
