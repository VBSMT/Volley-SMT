"use server";

import { revalidatePath } from "next/cache";
import { type GameCard, drawStarter } from "@/lib/domain/game";
import { getGameCards } from "@/lib/game";
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

  const { error: e2 } = await admin
    .from("game_collection")
    .insert(cards.map((c) => ({ owner_id: member.id, member_id: c.memberId, team_id: c.teamId })));
  if (e2) {
    await admin.from("game_boosters").delete().eq("id", booster.id);
    return { error: "Ouverture impossible. Réessayez." };
  }
  revalidatePath("/jeu");
  return { cards };
}
