"use server";

import { revalidatePath } from "next/cache";
import { cardKey, type GameCard } from "@/lib/domain/game";
import { addDays } from "@/lib/domain/game-week";
import { LISTING_DAYS, MAX_ROUNDS, OFFER_DAYS, TRADES_PER_WEEK, listingErrors, offerErrors } from "@/lib/domain/market";
import { getCollection, getGameCards } from "@/lib/game";
import { currentWeek } from "@/lib/game-week";
import { shortName } from "@/lib/format";
import { getCurrentMember, hasRole } from "@/lib/member";
import { notifyMembers } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Marché VUT entre joueurs : annonces, achats directs et offres. Échanges faits en base (`game_trade`). */
type Result = { error?: string };
type Admin = ReturnType<typeof createAdminClient>;

const ERRORS: Record<string, string> = {
  "VUT:closed": "Cette annonce n'est plus disponible.",
  "VUT:self": "C'est ta propre annonce.",
  "VUT:missing_card": "Une des cartes n'est plus dans la collection.",
  "VUT:shards": "Pas assez d'éclats.",
  "VUT:legend": "Les Légendes ne s'échangent pas.",
};
const tradeError = (message: string) => ERRORS[Object.keys(ERRORS).find((k) => message.includes(k)) ?? ""] ?? "Échange impossible. Réessayez.";

async function player() {
  const member = await getCurrentMember();
  return member && hasRole(member, "board") ? member : null;
}

/** Mes cartes (collection à jour). */
async function myCollection() {
  const client = await createClient();
  const all = await getGameCards(client);
  return { all, owned: await getCollection(client, all) };
}

/** Une carte encore utilisée dans une compo en cours ou à venir ne peut pas partir si c'est le dernier exemplaire. */
async function lockedInLineup(admin: Admin, ownerId: string, card: GameCard, copies: number) {
  if (copies > 1) return false;
  const { data } = await admin
    .from("game_lineups")
    .select("owner_id")
    .eq("owner_id", ownerId)
    .eq("member_id", card.memberId)
    .eq("team_id", card.teamId)
    .eq("kind", card.kind ?? "common")
    .gte("week_start", currentWeek())
    .limit(1);
  return !!data?.length;
}

/** Échanges conclus cette semaine (vendeur ou acheteur). */
async function tradesThisWeek(admin: Admin, id: string) {
  const since = `${addDays(currentWeek(), -1)}T22:00:00Z`;
  const { count } = await admin.from("game_listings").select("id", { count: "exact", head: true }).eq("status", "sold").gte("closed_at", since).or(`seller_id.eq.${id},buyer_id.eq.${id}`);
  return count ?? 0;
}

async function push(admin: Admin, memberId: string, title: string, body: string) {
  const { data: m } = await admin.from("members").select("id, email, first_name, notify_game").eq("id", memberId).maybeSingle();
  if (!m || m.notify_game === false) return;
  await notifyMembers([{ recipient: { id: m.id as string, email: m.email as string, first_name: m.first_name as string }, message: { title, body, url: "/jeu?vue=marche" } }]).catch(() => {});
}

const label = (c: { firstName: string; lastName: string; kind?: string }) => `${shortName(c.firstName, c.lastName)}${c.kind === "rare" ? " ★" : c.kind === "captain" ? " (C)" : ""}`;

/** Met une de ses cartes en vente : prix en éclats et/ou carte voulue (même rareté). */
export async function createListing(key: string, askShards: number | null, askKey: string | null): Promise<Result> {
  const me = await player();
  if (!me) return { error: "Réservé aux joueurs VUT." };
  const { all, owned } = await myCollection();
  const entry = owned.find((e) => cardKey(e.card) === key);
  if (!entry) return { error: "Carte absente de ta collection." };
  const ask = askKey ? (all.find((c) => cardKey(c) === askKey) ?? null) : null;
  if (askKey && !ask) return { error: "Carte demandée introuvable." };
  const shards = askShards === null ? null : Math.round(askShards);
  const errors = listingErrors(entry.card.kind ?? "common", shards, ask && { memberId: ask.memberId, teamId: ask.teamId, kind: ask.kind ?? "common" });
  if (errors.length) return { error: errors.join(" ") };
  const admin = createAdminClient();
  if (await lockedInLineup(admin, me.id, entry.card, entry.copies)) return { error: "Cette carte est dans ta compo : retire-la d'abord (ou garde un doublon)." };
  const { error } = await admin.from("game_listings").insert({
    seller_id: me.id,
    member_id: entry.card.memberId,
    team_id: entry.card.teamId,
    kind: entry.card.kind ?? "common",
    ask_shards: shards,
    ask_member_id: ask?.memberId ?? null,
    ask_team_id: ask?.teamId || null,
    ask_kind: ask?.kind ?? null,
  });
  if (error) return { error: error.code === "23505" ? "Cette carte est déjà en vente." : error.message.includes("VUT:") ? tradeError(error.message) : "Annonce non publiée." };
  revalidatePath("/jeu");
  return {};
}

export async function cancelListing(id: string): Promise<Result> {
  const me = await player();
  if (!me) return { error: "Réservé aux joueurs VUT." };
  const admin = createAdminClient();
  const { data } = await admin.from("game_listings").update({ status: "cancelled", closed_at: new Date().toISOString() }).eq("id", id).eq("seller_id", me.id).eq("status", "open").select("id");
  if (!data?.length) return { error: "Annonce introuvable." };
  await admin.from("game_offers").update({ status: "refused", decided_at: new Date().toISOString() }).eq("listing_id", id).eq("status", "pending");
  revalidatePath("/jeu");
  return {};
}

async function openListing(admin: Admin, id: string) {
  const since = new Date(Date.now() - LISTING_DAYS * 86_400_000).toISOString();
  const { data } = await admin.from("game_listings").select("*").eq("id", id).eq("status", "open").gte("created_at", since).maybeSingle();
  return data;
}

/** Vérifie les cartes proposées par un joueur (possédées, pas bloquées par sa compo). */
async function checkOwned(admin: Admin, ownerId: string, keys: string[]) {
  const { owned } = await myCollection();
  const cards: GameCard[] = [];
  for (const k of new Set(keys)) {
    const e = owned.find((x) => cardKey(x.card) === k);
    if (!e) return { error: "Carte absente de ta collection." };
    if (await lockedInLineup(admin, ownerId, e.card, e.copies)) return { error: `${label(e.card)} est dans ta compo : retire-la d'abord.` };
    cards.push(e.card);
  }
  return { cards };
}

/** Achat direct aux conditions du vendeur (éclats ou carte demandée). */
export async function buyListing(id: string, pay: "shards" | "card"): Promise<Result> {
  const me = await player();
  if (!me) return { error: "Réservé aux joueurs VUT." };
  const admin = createAdminClient();
  const l = await openListing(admin, id);
  if (!l) return { error: ERRORS["VUT:closed"] };
  if ((await tradesThisWeek(admin, me.id)) >= TRADES_PER_WEEK) return { error: `Limite de ${TRADES_PER_WEEK} échanges par semaine atteinte.` };
  let cards: GameCard[] = [];
  let shards = 0;
  if (pay === "shards") {
    if (l.ask_shards === null) return { error: "Le vendeur ne vend pas contre des éclats." };
    shards = l.ask_shards as number;
  } else {
    if (!l.ask_member_id) return { error: "Le vendeur ne demande pas de carte." };
    const r = await checkOwned(admin, me.id, [cardKey({ memberId: l.ask_member_id, teamId: l.ask_team_id ?? "", kind: l.ask_kind })]);
    if (r.error) return r;
    cards = r.cards!;
  }
  const { error } = await admin.rpc("game_trade", { p_listing: id, p_buyer: me.id, p_shards: shards, p_cards: cards.map((c) => ({ memberId: c.memberId, teamId: c.teamId, kind: c.kind ?? "common" })) });
  if (error) return { error: tradeError(error.message) };
  await push(admin, l.seller_id as string, "🔁 Carte vendue !", `${shortName(me.first_name, me.last_name)} a accepté ton annonce.`);
  revalidatePath("/jeu");
  return {};
}

/** Offre : éclats et/ou cartes (une de même rareté ou plusieurs moins rares). */
export async function makeOffer(listingId: string, shards: number, keys: string[]): Promise<Result> {
  const me = await player();
  if (!me) return { error: "Réservé aux joueurs VUT." };
  const admin = createAdminClient();
  const l = await openListing(admin, listingId);
  if (!l) return { error: ERRORS["VUT:closed"] };
  if (l.seller_id === me.id) return { error: ERRORS["VUT:self"] };
  const r = await checkOwned(admin, me.id, keys);
  if (r.error) return r;
  const cards = r.cards!.map((c) => ({ memberId: c.memberId, teamId: c.teamId, kind: c.kind ?? "common" }));
  const errors = offerErrors(l.kind, Math.round(shards), cards);
  if (errors.length) return { error: errors.join(" ") };
  const { data: wallet } = await admin.from("game_wallet").select("shards").eq("owner_id", me.id).maybeSingle();
  if (((wallet?.shards as number) ?? 0) < shards) return { error: ERRORS["VUT:shards"] };
  // Une offre en attente par acheteur et par annonce : la nouvelle remplace l'ancienne. En réponse
  // à une contre-offre du vendeur, c'est un aller-retour de plus (3 au plus).
  const { data: last } = await admin.from("game_offers").select("id, round, from_seller").eq("listing_id", listingId).eq("buyer_id", me.id).eq("status", "pending").maybeSingle();
  const round = last?.from_seller ? (last.round as number) + 1 : 1;
  if (round > MAX_ROUNDS) return { error: "Plus de contre-proposition possible : accepte ou refuse." };
  if (last) await admin.from("game_offers").update({ status: last.from_seller ? "countered" : "cancelled", decided_at: new Date().toISOString() }).eq("id", last.id);
  const { error } = await admin.from("game_offers").insert({ listing_id: listingId, buyer_id: me.id, shards: Math.round(shards), cards, round });
  if (error) return { error: "Offre non envoyée." };
  const what = [shards ? `✦ ${shards}` : "", ...r.cards!.map(label)].filter(Boolean).join(" + ");
  await push(admin, l.seller_id as string, "🔁 Nouvelle offre VUT", `${shortName(me.first_name, me.last_name)} propose ${what}.`);
  revalidatePath("/jeu");
  return {};
}

export async function cancelOffer(id: string): Promise<Result> {
  const me = await player();
  if (!me) return { error: "Réservé aux joueurs VUT." };
  const { data } = await createAdminClient().from("game_offers").update({ status: "cancelled", decided_at: new Date().toISOString() }).eq("id", id).eq("buyer_id", me.id).eq("status", "pending").select("id");
  if (!data?.length) return { error: "Offre introuvable." };
  revalidatePath("/jeu");
  return {};
}

/** Le vendeur accepte (échange immédiat) ou refuse une offre. */
export async function decideOffer(id: string, accept: boolean): Promise<Result> {
  const me = await player();
  if (!me) return { error: "Réservé aux joueurs VUT." };
  const admin = createAdminClient();
  const since = new Date(Date.now() - OFFER_DAYS * 86_400_000).toISOString();
  const { data: o } = await admin.from("game_offers").select("*, listing:game_listings(seller_id)").eq("id", id).eq("status", "pending").eq("from_seller", false).gte("created_at", since).maybeSingle();
  if (!o || (o.listing as { seller_id: string } | null)?.seller_id !== me.id) return { error: "Offre introuvable ou expirée." };
  if (!accept) {
    await admin.from("game_offers").update({ status: "refused", decided_at: new Date().toISOString() }).eq("id", id);
    await push(admin, o.buyer_id as string, "🔁 Offre refusée", "Le vendeur a refusé ton offre au marché VUT.");
    revalidatePath("/jeu");
    return {};
  }
  if ((await tradesThisWeek(admin, me.id)) >= TRADES_PER_WEEK || (await tradesThisWeek(admin, o.buyer_id as string)) >= TRADES_PER_WEEK) {
    return { error: `Limite de ${TRADES_PER_WEEK} échanges par semaine atteinte.` };
  }
  const { error } = await admin.rpc("game_trade", { p_listing: o.listing_id, p_buyer: o.buyer_id, p_shards: o.shards, p_cards: o.cards });
  if (error) return { error: tradeError(error.message) };
  await admin.from("game_offers").update({ status: "accepted", decided_at: new Date().toISOString() }).eq("id", id);
  await push(admin, o.buyer_id as string, "🔁 Offre acceptée !", "L'échange est fait : la carte est dans ta collection.");
  revalidatePath("/jeu");
  return {};
}

/**
 * Contre-offre du vendeur à une offre reçue : ses conditions (éclats et/ou cartes que l'acheteur
 * donnerait, mêmes règles qu'une offre). L'acheteur accepte, refuse ou contre-propose.
 */
export async function counterOffer(id: string, shards: number, keys: string[]): Promise<Result> {
  const me = await player();
  if (!me) return { error: "Réservé aux joueurs VUT." };
  const admin = createAdminClient();
  const since = new Date(Date.now() - OFFER_DAYS * 86_400_000).toISOString();
  const { data: o } = await admin.from("game_offers").select("*, listing:game_listings(seller_id, kind, status)").eq("id", id).eq("status", "pending").eq("from_seller", false).gte("created_at", since).maybeSingle();
  const l = o?.listing as { seller_id: string; kind: string; status: string } | null;
  if (!o || l?.seller_id !== me.id || l.status !== "open") return { error: "Offre introuvable ou expirée." };
  if ((o.round as number) >= MAX_ROUNDS) return { error: "Plus de contre-offre possible : accepte ou refuse." };
  const all = await getGameCards(await createClient());
  const cards = keys.flatMap((k) => all.find((c) => cardKey(c) === k) ?? []).map((c) => ({ memberId: c.memberId, teamId: c.teamId, kind: c.kind ?? "common" }));
  if (cards.length !== new Set(keys).size) return { error: "Carte introuvable." };
  const errors = offerErrors(l.kind as GameCard["kind"] & string, Math.round(shards), cards);
  if (errors.length) return { error: errors.join(" ") };
  await admin.from("game_offers").update({ status: "countered", decided_at: new Date().toISOString() }).eq("id", id);
  const { error } = await admin.from("game_offers").insert({ listing_id: o.listing_id, buyer_id: o.buyer_id, shards: Math.round(shards), cards, from_seller: true, round: (o.round as number) + 1 });
  if (error) return { error: "Contre-offre non envoyée." };
  const what = [shards ? `✦ ${Math.round(shards)}` : "", ...keys.flatMap((k) => all.find((c) => cardKey(c) === k) ?? []).map(label)].filter(Boolean).join(" + ");
  await push(admin, o.buyer_id as string, "🔁 Contre-offre VUT", `${shortName(me.first_name, me.last_name)} demande ${what}.`);
  revalidatePath("/jeu");
  return {};
}

/** L'acheteur accepte (échange immédiat, ses cartes et éclats) ou refuse une contre-offre du vendeur. */
export async function answerCounter(id: string, accept: boolean): Promise<Result> {
  const me = await player();
  if (!me) return { error: "Réservé aux joueurs VUT." };
  const admin = createAdminClient();
  const since = new Date(Date.now() - OFFER_DAYS * 86_400_000).toISOString();
  const { data: o } = await admin.from("game_offers").select("*, listing:game_listings(seller_id)").eq("id", id).eq("buyer_id", me.id).eq("status", "pending").eq("from_seller", true).gte("created_at", since).maybeSingle();
  if (!o) return { error: "Contre-offre introuvable ou expirée." };
  const seller = (o.listing as { seller_id: string } | null)?.seller_id ?? "";
  if (!accept) {
    await admin.from("game_offers").update({ status: "refused", decided_at: new Date().toISOString() }).eq("id", id);
    await push(admin, seller, "🔁 Contre-offre refusée", `${shortName(me.first_name, me.last_name)} a refusé ta contre-offre.`);
    revalidatePath("/jeu");
    return {};
  }
  const keys = ((o.cards as { memberId: string; teamId: string; kind: string }[]) ?? []).map((c) => cardKey({ memberId: c.memberId, teamId: c.teamId, kind: c.kind as GameCard["kind"] }));
  const r = await checkOwned(admin, me.id, keys);
  if (r.error) return r;
  if ((await tradesThisWeek(admin, me.id)) >= TRADES_PER_WEEK || (await tradesThisWeek(admin, seller)) >= TRADES_PER_WEEK) {
    return { error: `Limite de ${TRADES_PER_WEEK} échanges par semaine atteinte.` };
  }
  const { error } = await admin.rpc("game_trade", { p_listing: o.listing_id, p_buyer: me.id, p_shards: o.shards, p_cards: o.cards });
  if (error) return { error: tradeError(error.message) };
  await admin.from("game_offers").update({ status: "accepted", decided_at: new Date().toISOString() }).eq("id", id);
  await push(admin, seller, "🔁 Contre-offre acceptée !", `${shortName(me.first_name, me.last_name)} a accepté : l'échange est fait.`);
  revalidatePath("/jeu");
  return {};
}
