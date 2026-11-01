"use server";

import { revalidatePath } from "next/cache";
import { type GameCard, cardKey, drawEarned, drawStarter } from "@/lib/domain/game";
import { type Lineup, SLOTS, addDays, bonusLocked, frozenPositions, samePick, withFrozen, editableWeek, isLocked, lineupErrors, weekStart } from "@/lib/domain/game-week";
import { rewardReason, shardPrice, shardsFromOpening } from "@/lib/domain/game-rewards";
import { getCollection, getGameCards } from "@/lib/game";
import { awardBooster, getDailyState } from "@/lib/game-rewards";
import { parisClock } from "@/lib/domain/notifications";
import { currentWeek, getLineup, getWeekMatches } from "@/lib/game-week";
import { getCurrentMember } from "@/lib/member";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Ouvre le booster de départ (une seule fois) : tirage côté serveur, collection enregistrée. */
export async function openStarter(): Promise<{ cards?: GameCard[]; error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
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

/** Ajoute des cartes à une collection, en une seule opération en base (un doublon augmente le nombre d'exemplaires). */
async function addToCollection(admin: Admin, ownerId: string, cards: GameCard[], gifted = false): Promise<string | null> {
  const payload = cards.map((c) => ({ memberId: c.memberId, teamId: c.teamId || "", kind: c.kind ?? "common", position: c.position }));
  const { error } = await admin.rpc("game_add_cards", { p_owner: ownerId, p_cards: payload, p_gifted: gifted });
  return error?.message ?? null;
}

/**
 * Ouvre un booster gagné : 2 ou 3 cartes au hasard (doublons possibles), ou les cartes choisies
 * d'avance s'il s'agit d'un cadeau du maître du jeu (marquées « Cadeau » dans la collection).
 */
export async function openEarned(boosterId: string): Promise<{ cards?: GameCard[]; shards?: number; message?: string; error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const admin = createAdminClient();
  const { data: booster } = await admin
    .from("game_boosters")
    .select("gift_cards, message")
    .eq("id", boosterId)
    .eq("owner_id", member.id)
    .eq("kind", "earned")
    .is("opened_at", null)
    .maybeSingle();
  if (!booster) return { error: "Booster introuvable ou déjà ouvert." };
  const all = await getGameCards(await createClient());
  const gift = booster.gift_cards as GameCard[] | null;
  // Cadeau : cartes à jour (note, photo) si elles existent encore, sinon telles qu'offertes.
  const byKey = new Map(all.map((c) => [cardKey(c), c]));
  const cards = gift?.length ? gift.map((c) => byKey.get(cardKey(c)) ?? c) : drawEarned(all);
  if (!cards.length) return { error: "Aucune carte disponible." };
  // Condition « pas encore ouvert » dans la mise à jour : un double clic n'ouvre pas deux fois.
  const { data } = await admin
    .from("game_boosters")
    .update({ cards, opened_at: new Date().toISOString() })
    .eq("id", boosterId)
    .eq("owner_id", member.id)
    .is("opened_at", null)
    .select("id");
  if (!data?.length) return { error: "Booster introuvable ou déjà ouvert." };
  // Éclats : 1 par carte déjà possédée (ou sortie deux fois dans ce booster).
  const { data: owned } = await admin.from("game_collection").select("member_id, team_id, kind").eq("owner_id", member.id);
  const shards = shardsFromOpening(new Set((owned ?? []).map((r) => cardKey({ memberId: r.member_id, teamId: r.team_id ?? "", kind: r.kind }))), cards);
  const error = await addToCollection(admin, member.id, cards, !!gift?.length);
  if (error) return { error: "Ouverture impossible. Réessayez." };
  // Doublons gardés (plus d'éclat automatique) : à recycler ou à vendre au marché.
  // Pas de revalidatePath : la page changerait pendant l'animation (« Voir ma collection » rafraîchit).
  return { cards, shards, message: (booster.message as string | null) ?? undefined };
}

/**
 * Enregistre l'équipe de la semaine : règles vérifiées, cartes verrouillées (match commencé)
 * inchangées. La première validation fixe l'heure de départage.
 */
export async function saveLineup(lineup: Lineup, week: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };

  // Journée en cours ou à venir (jusqu'à 4 semaines) ; les journées passées sont en lecture seule.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || weekStart(week) !== week || !editableWeek(week, currentWeek())) {
    return { error: "Cette journée n'est plus modifiable." };
  }
  const supabase = await createClient();
  const cards = await getGameCards(supabase);
  const owned = (await getCollection(supabase, cards)).map((e) => e.card);
  const [previous, matches] = await Promise.all([getLineup(supabase, member.id, week), getWeekMatches(supabase, week)]);
  // Une carte laissée à sa place garde le poste figé à la validation précédente.
  const kept: Lineup = Object.fromEntries(SLOTS.filter((s) => samePick(lineup[s], previous[s])).map((s) => [s, previous[s]]));
  const errors = lineupErrors(lineup, withFrozen(owned, kept));
  if (errors.length) return { error: errors.join(" ") };
  const positions = frozenPositions(lineup, previous, owned);
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
    return pick ? [{ owner_id: member.id, week_start: week, slot, member_id: pick.memberId, team_id: pick.teamId || null, kind: pick.kind ?? "common", position: positions[slot] ?? null }] : [];
  });
  const { error: e2 } = await admin.from("game_lineups").insert(rows);
  if (e2) return { error: "Enregistrement impossible. Réessayez." };
  // ignoreDuplicates : l'heure de la première validation reste celle du départage. Une compo
  // validée à l'avance compte comme validée au début de sa journée (pas d'avantage au départage).
  const weekOpens = `${addDays(week, -1)}T22:00:00Z`; // lundi 0h, heure de Paris (à 1 h près)
  const validatedAt = new Date(Math.max(now.getTime(), Date.parse(weekOpens))).toISOString();
  await admin
    .from("game_weeks")
    .upsert({ owner_id: member.id, week_start: week, validated_at: validatedAt }, { onConflict: "owner_id,week_start", ignoreDuplicates: true });
  // Récompense (une fois par semaine) : tout de suite pour la journée en cours ; pour une journée
  // validée à l'avance, au début de cette journée (tâche de 22h), si la compo existe encore.
  if (week === currentWeek()) {
    await awardBooster(admin, member.id, rewardReason.week(week), "Équipe de la semaine validée : un booster pour toi !");
  }
  revalidatePath("/jeu");
  return {};
}

/** Ajoute (ou retire) des éclats en une seule opération ; null si le solde serait négatif. */
async function addShards(admin: Admin, ownerId: string, n: number): Promise<number | null> {
  const { data, error } = await admin.rpc("game_add_shards", { p_owner: ownerId, p_n: n });
  return error ? null : (data as number | null);
}

/** Échange des éclats contre une carte au choix : commune 5, rare 20. */
/** Recycle un doublon : un exemplaire en trop devient 1 éclat. */
export async function recycleCard(key: string): Promise<{ error?: string; shards?: number }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const card = (await getCollection(await createClient(), await getGameCards(await createClient()))).find((e) => cardKey(e.card) === key);
  if (!card || card.copies < 2) return { error: "Pas de doublon à recycler." };
  const { data, error } = await createAdminClient().rpc("game_recycle", {
    p_owner: member.id,
    p_member: card.card.memberId,
    p_team: card.card.teamId || null,
    p_kind: card.card.kind ?? "common",
  });
  if (error || data === null) return { error: "Recyclage impossible." };
  revalidatePath("/jeu");
  return { shards: data as number };
}

export async function exchangeShards(key: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const card = (await getGameCards(await createClient())).find((c) => cardKey(c) === key);
  const price = card ? shardPrice(card) : null;
  if (!card || price === null) return { error: "Carte non disponible contre des éclats." };
  const admin = createAdminClient();
  // Débit atomique en base : refusé si le solde est insuffisant, même avec des actions simultanées.
  if ((await addShards(admin, member.id, -price)) === null) return { error: `Il faut ${price} éclats.` };
  const error = await addToCollection(admin, member.id, [card]);
  if (error) {
    await addShards(admin, member.id, price);
    return { error: "Échange impossible. Réessayez." };
  }
  revalidatePath("/jeu");
  return {};
}

/** Booster du jour (une fois par jour, heure de Paris) et, au 7ᵉ jour de suite, un booster bonus. */
export async function claimDaily(): Promise<{ error?: string; bonus?: boolean }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const admin = createAdminClient();
  const state = await getDailyState(admin, member.id);
  if (state.claimedToday) return { error: "Booster du jour déjà récupéré. Reviens demain !" };
  const today = parisClock(new Date()).date;
  // L'index unique (joueur, raison) empêche un double booster, même en cas de double toucher.
  const { error } = await admin.from("game_boosters").insert({ owner_id: member.id, kind: "earned", reason: rewardReason.daily(today) });
  if (error) return { error: error.code === "23505" ? "Booster du jour déjà récupéré." : "Récupération impossible. Réessayez." };
  if (state.bonusToday) await admin.from("game_boosters").insert({ owner_id: member.id, kind: "earned", reason: rewardReason.streak(today) });
  revalidatePath("/", "layout");
  return { bonus: state.bonusToday };
}
