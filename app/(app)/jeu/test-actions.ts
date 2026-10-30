"use server";

import { revalidatePath } from "next/cache";
import { formRating } from "@/lib/domain/game";
import { scorePoints } from "@/lib/domain/game";
import { computeWeek, currentWeek } from "@/lib/game-week";
import { getCurrentMember, hasRole } from "@/lib/member";
import { getGameCards } from "@/lib/game";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Outils de test de VUT (Bureau) : agissent pour tous les joueurs qui ont accès au jeu
 * (le Bureau pour l'instant). À retirer ou restreindre à l'ouverture du jeu à tous.
 */
type Result = { error?: string; message?: string };
const NO_ID = "00000000-0000-0000-0000-000000000000";

async function guard() {
  const member = await getCurrentMember();
  return member && hasRole(member, "board") ? createAdminClient() : null;
}

/** Joueurs ayant accès au jeu : membres du Bureau. */
async function players(admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data } = await admin.from("member_roles").select("member_id").eq("role", "board");
  return [...new Set((data ?? []).map((r) => r.member_id as string))];
}

/** Remise à zéro complète : boosters, collections, équipes, points, résultats simulés. */
export async function resetAll(): Promise<Result> {
  const admin = await guard();
  if (!admin) return { error: "Réservé au Bureau." };
  for (const table of ["game_lineups", "game_weeks", "game_collection", "game_boosters", "game_wallet"]) {
    const { error } = await admin.from(table).delete().neq("owner_id", NO_ID);
    if (error) return { error: error.message };
  }
  await admin.from("game_test_results").delete().neq("id", NO_ID);
  revalidatePath("/jeu");
  return { message: "VUT remis à zéro pour tout le monde." };
}

/** Donne un booster (2 ou 3 cartes) à chaque joueur. */
export async function giveBoosters(count = 1): Promise<Result> {
  const admin = await guard();
  if (!admin) return { error: "Réservé au Bureau." };
  const ids = await players(admin);
  const rows = ids.flatMap((owner_id) => Array.from({ length: count }, () => ({ owner_id, kind: "earned", reason: "test" })));
  const { error } = await admin.from("game_boosters").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/jeu");
  return { message: `${count} booster${count > 1 ? "s" : ""} donné${count > 1 ? "s" : ""} à ${ids.length} joueur${ids.length > 1 ? "s" : ""}.` };
}

/** Simule un résultat de la semaine pour une équipe : note de forme et points recalculés. */
export async function simulateResult(teamId: string, score: string): Promise<Result> {
  const admin = await guard();
  if (!admin) return { error: "Réservé au Bureau." };
  if (!["s30", "s31", "s32", "s23", "s13", "s03"].includes(score)) return { error: "Score inconnu." };
  const week = currentWeek();
  const { error } = await admin.from("game_test_results").insert({ team_id: teamId, week_start: week, score });
  if (error) return { error: error.message };
  const { data: form } = await admin.from("game_team_form").select("recent, last_scores, best_rating").eq("team_id", teamId).maybeSingle();
  const recent = [...((form?.recent as number[]) ?? []), scorePoints(score as "s30")].slice(-5);
  const rating = formRating(recent);
  await admin.from("game_team_form").upsert({
    team_id: teamId,
    recent,
    last_scores: form?.last_scores ?? null,
    rating,
    best_rating: Math.max((form?.best_rating as number) ?? rating, rating),
    updated_at: new Date().toISOString(),
  });
  await computeWeek(admin, week);
  revalidatePath("/jeu");
  return { message: `Résultat simulé : note ${rating}, points recalculés.` };
}

/** Efface les résultats simulés et remet les notes de forme à 60 (recalculées à la prochaine synchro). */
export async function clearSimulations(): Promise<Result> {
  const admin = await guard();
  if (!admin) return { error: "Réservé au Bureau." };
  await admin.from("game_test_results").delete().neq("id", NO_ID);
  await admin.from("game_team_form").delete().neq("team_id", NO_ID);
  await computeWeek(admin, currentWeek());
  revalidatePath("/jeu");
  return { message: "Simulations effacées, notes remises à 60." };
}

/** Recalcule tout de suite les points de la semaine (sans attendre 7h). */
export async function recomputeNow(): Promise<Result> {
  const admin = await guard();
  if (!admin) return { error: "Réservé au Bureau." };
  const n = await computeWeek(admin, currentWeek());
  revalidatePath("/jeu");
  return { message: `Points recalculés pour ${n} équipe${n > 1 ? "s" : ""}.` };
}

/** Donne à chaque joueur une carte Capitaine et une Légende au hasard (tester la case Bonus). */
export async function giveSpecials(): Promise<Result> {
  const admin = await guard();
  if (!admin) return { error: "Réservé au Bureau." };
  // La vue des cartes est lue avec les droits du Bureau connecté (elle est réservée au Bureau).
  const cards = await getGameCards(await createClient());
  const captains = cards.filter((c) => c.kind === "captain");
  const legends = cards.filter((c) => c.kind === "legend");
  if (!captains.length && !legends.length) return { error: "Aucun capitaine ni Légende configurés." };
  const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];
  const rows = (await players(admin)).flatMap((owner_id) =>
    [captains.length ? pick(captains) : null, legends.length ? pick(legends) : null]
      .filter((c) => !!c)
      .map((c) => ({ owner_id, member_id: c!.memberId, team_id: c!.teamId || null, kind: c!.kind })),
  );
  const { error } = await admin.from("game_collection").upsert(rows, { onConflict: "owner_id,member_id,team_id,kind", ignoreDuplicates: true });
  if (error) return { error: error.message };
  revalidatePath("/jeu");
  return { message: "Un Capitaine et une Légende ajoutés à chaque collection." };
}
