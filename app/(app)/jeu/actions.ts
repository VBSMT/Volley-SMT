"use server";

import { revalidatePath } from "next/cache";
import { type GameCard, cardKey, drawEarned, drawStarter } from "@/lib/domain/game";
import { type Lineup, SLOTS, bonusLocked, isLocked, lineupErrors } from "@/lib/domain/game-week";
import { exchangeable, rewardReason, SHARDS_PER_CARD, shardsFromOpening } from "@/lib/domain/game-rewards";
import { getCollection, getGameCards } from "@/lib/game";
import { awardBooster } from "@/lib/game-rewards";
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
  const { data } = await admin.from("game_collection").select("member_id, team_id, kind, copies").eq("owner_id", ownerId);
  const copies = new Map((data ?? []).map((r) => [cardKey({ memberId: r.member_id, teamId: r.team_id ?? "", kind: r.kind }), r.copies as number]));
  for (const c of cards) copies.set(cardKey(c), (copies.get(cardKey(c)) ?? 0) + 1);
  const unique = new Map(cards.map((c) => [cardKey(c), c]));
  const rows = [...unique.entries()].map(([key, c]) => ({
    owner_id: ownerId,
    member_id: c.memberId,
    team_id: c.teamId || null,
    kind: c.kind ?? "common",
    copies: copies.get(key)!,
  }));
  const { error } = await admin.from("game_collection").upsert(rows, { onConflict: "owner_id,member_id,team_id,kind" });
  return error?.message ?? null;
}

/** Ouvre un booster gagné (2 ou 3 cartes au hasard, doublons possibles). */
export async function openEarned(boosterId: string): Promise<{ cards?: GameCard[]; shards?: number; error?: string }> {
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
  // Éclats : 1 par carte déjà possédée (ou sortie deux fois dans ce booster).
  const { data: owned } = await admin.from("game_collection").select("member_id, team_id, kind").eq("owner_id", member.id);
  const shards = shardsFromOpening(new Set((owned ?? []).map((r) => cardKey({ memberId: r.member_id, teamId: r.team_id ?? "", kind: r.kind }))), cards);
  const error = await addToCollection(admin, member.id, cards);
  if (error) return { error: "Ouverture impossible. Réessayez." };
  if (shards) await addShards(admin, member.id, shards);
  // Pas de revalidatePath : la page changerait pendant l'animation (« Voir ma collection » rafraîchit).
  return { cards, shards };
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
    if (before?.memberId === after?.memberId && before?.teamId === after?.teamId && before?.kind === after?.kind) continue;
    if ((before && isLocked(before.teamId, matches, now)) || (after && isLocked(after.teamId, matches, now))) {
      return { error: "Une carte est verrouillée : le match de son équipe a commencé." };
    }
    if (slot === "bonus" && bonusLocked(previous, matches, now)) {
      return { error: "Case Bonus verrouillée : le premier match d'un de tes titulaires a commencé." };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from("game_lineups").delete().eq("owner_id", member.id).eq("week_start", week);
  if (error) return { error: "Enregistrement impossible. Réessayez." };
  const rows = SLOTS.flatMap((slot) => {
    const pick = lineup[slot];
    return pick ? [{ owner_id: member.id, week_start: week, slot, member_id: pick.memberId, team_id: pick.teamId || null, kind: pick.kind ?? "common" }] : [];
  });
  const { error: e2 } = await admin.from("game_lineups").insert(rows);
  if (e2) return { error: "Enregistrement impossible. Réessayez." };
  // ignoreDuplicates : l'heure de la première validation reste celle du départage.
  await admin.from("game_weeks").upsert({ owner_id: member.id, week_start: week }, { onConflict: "owner_id,week_start", ignoreDuplicates: true });
  // Récompense : un booster pour la première validation de la semaine (une seule fois).
  await awardBooster(admin, member.id, rewardReason.week(week), "Équipe de la semaine validée : un booster pour toi !");
  revalidatePath("/jeu");
  return {};
}

async function addShards(admin: Admin, ownerId: string, n: number) {
  const { data } = await admin.from("game_wallet").select("shards").eq("owner_id", ownerId).maybeSingle();
  await admin.from("game_wallet").upsert({ owner_id: ownerId, shards: ((data?.shards as number) ?? 0) + n });
}

/** Échange 5 éclats contre une carte commune ou rare au choix. */
export async function exchangeShards(key: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  if (!hasRole(member, "board")) return { error: "Réservé au Bureau pour l'instant." };
  const card = (await getGameCards(await createClient())).find((c) => cardKey(c) === key);
  if (!card || !exchangeable(card)) return { error: "Carte non disponible contre des éclats." };
  const admin = createAdminClient();
  const { data } = await admin.from("game_wallet").select("shards").eq("owner_id", member.id).maybeSingle();
  const shards = (data?.shards as number) ?? 0;
  if (shards < SHARDS_PER_CARD) return { error: `Il faut ${SHARDS_PER_CARD} éclats.` };
  // Débit conditionnel : deux échanges simultanés ne peuvent pas dépenser les mêmes éclats.
  const { data: spent } = await admin
    .from("game_wallet")
    .update({ shards: shards - SHARDS_PER_CARD })
    .eq("owner_id", member.id)
    .eq("shards", shards)
    .select("owner_id");
  if (!spent?.length) return { error: "Réessayez." };
  const error = await addToCollection(admin, member.id, [card]);
  if (error) {
    await admin.from("game_wallet").update({ shards }).eq("owner_id", member.id);
    return { error: "Échange impossible. Réessayez." };
  }
  revalidatePath("/jeu");
  return {};
}
