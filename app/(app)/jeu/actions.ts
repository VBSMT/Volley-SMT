"use server";

import { revalidatePath } from "next/cache";
import { type GameCard, drawEarned, drawStarter } from "@/lib/domain/game";
import { type Lineup, SLOTS, isLocked, lineupErrors } from "@/lib/domain/game-week";
import { getCollection, getGameCards } from "@/lib/game";
import { currentWeek, getLineup, getWeekMatches } from "@/lib/game-week";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Ouvre le booster de départ (une seule fois) : tirage côté serveur, collection enregistrée. */
export async function openStarter(): Promise<{ cards?: GameCard[]; error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  if (!hasRole(member, "board")) return { error: "Réservé au Bureau pour l'instant." };
  const cards = drawStarter(await getGameCards(await createClient()));
  if (!cards.length) return { error: "Aucune carte disponible : les joueurs doivent d'abord renseigner leur poste." };

  const admin = createAdminClient();
  // L'index unique (un booster de départ par joueur) empêche un second tirage, même en double clic.
  const { data: booster, error } = await admin
    .from("game_boosters")
    .insert({ owner_id: member.id, kind: "starter", cards, opened_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !booster) return { error: error?.code === "23505" ? "Booster déjà ouvert." : "Ouverture impossible. Réessayez." };

  const e2 = await addToCollection(admin, member.id, cards);
  if (e2) {
    await admin.from("game_boosters").delete().eq("id", booster.id);
    return { error: "Ouverture impossible. Réessayez." };
  }
  // Pas de revalidatePath : la page changerait pendant l'animation (« Voir ma collection » rafraîchit).
  return { cards };
}

type Admin = ReturnType<typeof createAdminClient>;

/** Ajoute des cartes à une collection (un doublon augmente le nombre d'exemplaires). */
async function addToCollection(admin: Admin, ownerId: string, cards: GameCard[]): Promise<string | null> {
  const { data } = await admin.from("game_collection").select("member_id, team_id, copies").eq("owner_id", ownerId);
  const copies = new Map((data ?? []).map((r) => [`${r.member_id}:${r.team_id}`, r.copies as number]));
  for (const c of cards) copies.set(`${c.memberId}:${c.teamId}`, (copies.get(`${c.memberId}:${c.teamId}`) ?? 0) + 1);
  const rows = [...new Set(cards.map((c) => `${c.memberId}:${c.teamId}`))].map((k) => {
    const [member_id, team_id] = k.split(":");
    return { owner_id: ownerId, member_id, team_id, copies: copies.get(k)! };
  });
  const { error } = await admin.from("game_collection").upsert(rows, { onConflict: "owner_id,member_id,team_id" });
  return error?.message ?? null;
}

/** Ouvre un booster gagné (2 ou 3 cartes au hasard, doublons possibles). */
export async function openEarned(boosterId: string): Promise<{ cards?: GameCard[]; error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  if (!hasRole(member, "board")) return { error: "Réservé au Bureau pour l'instant." };
  const cards = drawEarned(await getGameCards(await createClient()));
  if (!cards.length) return { error: "Aucune carte disponible." };
  const admin = createAdminClient();
  // Condition « pas encore ouvert » dans la mise à jour : un double clic n'ouvre pas deux fois.
  const { data } = await admin
    .from("game_boosters")
    .update({ cards, opened_at: new Date().toISOString() })
    .eq("id", boosterId)
    .eq("owner_id", member.id)
    .eq("kind", "earned")
    .is("opened_at", null)
    .select("id");
  if (!data?.length) return { error: "Booster introuvable ou déjà ouvert." };
  const error = await addToCollection(admin, member.id, cards);
  if (error) return { error: "Ouverture impossible. Réessayez." };
  // Pas de revalidatePath : la page changerait pendant l'animation (« Voir ma collection » rafraîchit).
  return { cards };
}

/**
 * Enregistre l'équipe de la semaine : règles vérifiées, cartes verrouillées (match commencé)
 * inchangées. La première validation fixe l'heure de départage.
 */
export async function saveLineup(lineup: Lineup): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  if (!hasRole(member, "board")) return { error: "Réservé au Bureau pour l'instant." };

  const supabase = await createClient();
  const cards = await getGameCards(supabase);
  const owned = (await getCollection(supabase, cards)).map((e) => e.card);
  const errors = lineupErrors(lineup, owned);
  if (errors.length) return { error: errors.join(" ") };

  const week = currentWeek();
  const [previous, matches] = await Promise.all([getLineup(supabase, member.id, week), getWeekMatches(supabase, week)]);
  const now = new Date();
  for (const slot of SLOTS) {
    const before = previous[slot];
    const after = lineup[slot];
    if (before?.memberId === after?.memberId && before?.teamId === after?.teamId) continue;
    if ((before && isLocked(before.teamId, matches, now)) || (after && isLocked(after.teamId, matches, now))) {
      return { error: "Une carte est verrouillée : le match de son équipe a commencé." };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from("game_lineups").delete().eq("owner_id", member.id).eq("week_start", week);
  if (error) return { error: "Enregistrement impossible. Réessayez." };
  const rows = SLOTS.flatMap((slot) => (lineup[slot] ? [{ owner_id: member.id, week_start: week, slot, member_id: lineup[slot]!.memberId, team_id: lineup[slot]!.teamId }] : []));
  const { error: e2 } = await admin.from("game_lineups").insert(rows);
  if (e2) return { error: "Enregistrement impossible. Réessayez." };
  // ignoreDuplicates : l'heure de la première validation reste celle du départage.
  await admin.from("game_weeks").upsert({ owner_id: member.id, week_start: week }, { onConflict: "owner_id,week_start", ignoreDuplicates: true });
  revalidatePath("/jeu");
  return {};
}
