"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type GameCard, cardKey } from "@/lib/domain/game";
import { getGameCards } from "@/lib/game";
import { isGameMaster } from "@/lib/game-master";
import { gamePlayers } from "@/lib/game-rewards";
import { getCurrentMember } from "@/lib/member";
import { notifyMembers } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Cadeaux VUT du maître du jeu (`VUT_MASTER_EMAIL`) : boosters ou carte précise. */
type Result = { error?: string; message?: string; ids?: string[] };
export type GiftTarget = { type: "member" | "team"; id: string } | { type: "all" };
export type Gift = { type: "boosters"; count: number } | { type: "card"; key: string };

const MAX_BOOSTERS = 5;
const MAX_MESSAGE = 140;

export async function sendGift(target: GiftTarget, gift: Gift, message: string): Promise<Result> {
  const member = await getCurrentMember();
  if (!isGameMaster(member)) return { error: "Réservé au maître du jeu." };
  const admin = createAdminClient();
  const players = await gamePlayers(admin);
  let owners: string[];
  if (target.type === "all") owners = players;
  else if (target.type === "member") owners = players.filter((id) => id === target.id);
  else {
    const { data } = await admin.from("member_teams").select("member_id").eq("team_id", target.id);
    const inTeam = new Set((data ?? []).map((r) => r.member_id as string));
    owners = players.filter((id) => inTeam.has(id));
  }
  if (!owners.length) return { error: "Aucun joueur du jeu à qui l'envoyer." };

  let giftCards: GameCard[] | null = null;
  let count = 1;
  if (gift.type === "card") {
    const card = (await getGameCards(await createClient())).find((c) => cardKey(c) === gift.key);
    if (!card) return { error: "Carte introuvable." };
    giftCards = [card];
  } else {
    count = Math.min(MAX_BOOSTERS, Math.max(1, Math.round(gift.count)));
  }
  const text = message.trim().slice(0, MAX_MESSAGE) || null;
  // Une raison unique par booster (l'index « une récompense par raison » ne s'y oppose pas).
  const rows = owners.flatMap((owner_id) =>
    Array.from({ length: count }, () => ({ owner_id, kind: "earned", reason: `gift:${randomUUID()}`, gift_cards: giftCards, message: text })),
  );
  const { data, error } = await admin.from("game_boosters").insert(rows).select("id");
  if (error) return { error: "Envoi impossible. Réessayez." };

  const { data: people } = await admin.from("members").select("id, email, first_name").in("id", owners);
  const what = giftCards ? "une carte t'attend" : `${count} booster${count > 1 ? "s" : ""} t'attend${count > 1 ? "ent" : ""}`;
  await notifyMembers(
    (people ?? []).map((m) => ({
      recipient: { id: m.id as string, email: m.email as string, first_name: m.first_name as string },
      message: { title: "🎁 Cadeau VUT", body: text ? `${text} (${what})` : `Un cadeau : ${what} !`, url: "/jeu?vue=boosters" },
    })),
  ).catch(() => {});
  revalidatePath("/", "layout");
  const n = owners.length;
  return { message: `Cadeau envoyé à ${n} joueur${n > 1 ? "s" : ""}.`, ids: (data ?? []).map((r) => r.id as string) };
}

/** Annule des cadeaux pas encore ouverts. */
export async function cancelGifts(ids: string[]): Promise<Result> {
  const member = await getCurrentMember();
  if (!isGameMaster(member)) return { error: "Réservé au maître du jeu." };
  const { data } = await createAdminClient().from("game_boosters").delete().in("id", ids).like("reason", "gift:%").is("opened_at", null).select("id");
  revalidatePath("/", "layout");
  const n = data?.length ?? 0;
  return n ? { message: `${n} cadeau${n > 1 ? "x" : ""} annulé${n > 1 ? "s" : ""}.` } : { error: "Déjà ouvert : impossible d'annuler." };
}
