import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type CardKind, GAME_POSITION_LABELS, STARTER_SIZE, cardKey } from "@/lib/domain/game";
import { defaultMatchday, editableWeek, isLocked, matchdayDates, opponentRank, positionChanges, withFrozen } from "@/lib/domain/game-week";
import { getCurrentSeason } from "@/lib/season";
import { getDailyState } from "@/lib/game-rewards";
import { getCollection, getGameCards, starterOpened } from "@/lib/game";
import { currentWeek, getLineup, getMatchdays, getWeekFixtures, getWeekMatches } from "@/lib/game-week";
import { getLatestSnapshots } from "@/lib/stats";
import { WeekFixtures, type FixtureRow } from "./WeekFixtures";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { openEarned, openStarter } from "./actions";
import { BoosterOpening } from "./BoosterOpening";
import { CollectionView } from "./CollectionView";
import { MarketView, type ListingRow, type OfferRow } from "./MarketView";
import { LISTING_DAYS, OFFER_DAYS } from "@/lib/domain/market";
import { LineupEditor } from "./LineupEditor";
import { Ranking } from "./Ranking";
import { TestTools } from "./TestTools";
import { GiftPanel, type GiftHistoryRow } from "./GiftPanel";
import { isGameMaster, testToolsEnabled } from "@/lib/game-master";
import { shortName } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { DailyCard } from "./DailyCard";

export const metadata: Metadata = { title: "VUT" };

const TABS = [
  ["equipe", "Équipe"],
  ["boosters", "Boosters"],
  ["collection", "Collection"],
  ["classement", "Classement"],
] as const;
type Tab = (typeof TABS)[number][0];

/** VUT (Volley Ultimate Team), réservé au Bureau pour l'instant. */
export default async function JeuPage({ searchParams }: { searchParams: Promise<{ vue?: string; journee?: string; vendre?: string }> }) {
  const member = (await getCurrentMember())!;
  if (!hasRole(member, "board")) notFound();
  const { vue, journee, vendre } = await searchParams;
  // « Marché » s'ouvre depuis l'album (onglet Collection en surbrillance).
  const market = vue === "marche";
  const tab: Tab = market ? "collection" : TABS.some(([k]) => k === vue) ? (vue as Tab) : "equipe";

  const supabase = await createClient();
  const [cards, opened, { data: teams }] = await Promise.all([
    getGameCards(supabase),
    starterOpened(supabase, member.id),
    supabase.from("teams").select("id, name").order("name"),
  ]);

  const header = (
    <h1 className="vut-title">
      Volley Ultimate Team
      <small aria-hidden="true">✦ VUT ✦</small>
    </h1>
  );
  // Cadeaux et outils de test : maître du jeu seulement (VUT_MASTER_EMAIL).
  let tools: React.ReactNode = null;
  if (isGameMaster(member)) {
    const admin = createAdminClient();
    const [{ data: people }, { data: gifts }] = await Promise.all([
      admin.from("members").select("id, first_name, last_name"),
      admin.from("game_boosters").select("id, owner_id, gift_cards, message, created_at, opened_at").like("reason", "gift:%").order("created_at", { ascending: false }).limit(20),
    ]);
    const nameOf = new Map((people ?? []).map((p) => [p.id as string, shortName(p.first_name as string, p.last_name as string)]));
    const kindLabel = { common: "commune", rare: "rare", captain: "Capitaine", legend: "Légende" } as const;
    const history: GiftHistoryRow[] = (gifts ?? []).map((g) => {
      const card = (g.gift_cards as typeof cards | null)?.[0];
      return {
        id: g.id as string,
        to: nameOf.get(g.owner_id as string) ?? "?",
        what: card ? `${shortName(card.firstName, card.lastName)} (${kindLabel[card.kind ?? "common"]})` : "Booster",
        at: new Date(g.created_at as string).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" }),
        opened: !!g.opened_at,
        message: (g.message as string | null) ?? null,
      };
    });
    tools = (
      <>
        <GiftPanel
          players={[...nameOf].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))}
          teams={(teams ?? []).map((t) => ({ id: t.id as string, label: t.name as string }))}
          cards={cards
            .map((c) => ({ id: cardKey(c), label: `${shortName(c.firstName, c.lastName)} · ${kindLabel[c.kind ?? "common"]}${c.kind === "legend" ? "" : ` · ${c.teamName}`}` }))
            .sort((a, b) => a.label.localeCompare(b.label))}
          history={history}
        />
        {testToolsEnabled() && <TestTools teams={teams ?? []} />}
      </>
    );
  }

  if (!opened) {
    return (
      <main className="page stack vut-page">
        {header}
        <p>Bienvenue ! Ouvre ton premier booster : {STARTER_SIZE} joueurs du club, dont au moins un par poste.</p>
        <BoosterOpening label={`${STARTER_SIZE} joueurs`} open={openStarter} starter />
        {tools}
      </main>
    );
  }

  const { data: pending } = await supabase.from("game_boosters").select("id, gift_cards").eq("kind", "earned").is("opened_at", null).order("created_at");
  const waiting = pending?.length ?? 0;

  const collection = await getCollection(supabase, cards);
  // Album complet : cartes du club + rares gardées dont le joueur a retiré son poste 2.
  const known = new Set(cards.map(cardKey));
  const allCards = [...cards, ...collection.map((e) => e.card).filter((c) => !known.has(cardKey(c)))];
  const week = currentWeek();

  let content: React.ReactNode;
  if (tab === "equipe") {
    const season = await getCurrentSeason(supabase);
    const days = await getMatchdays(supabase, season);
    // Journée choisie (calendrier des matchs) : en cours par défaut, sinon la prochaine.
    const selected = journee && days.includes(journee) ? journee : defaultMatchday(days, week);
    const index = days.indexOf(selected);
    const prevDay = index > 0 ? days[index - 1] : null;
    const nextDay = index >= 0 && index < days.length - 1 ? days[index + 1] : null;
    const readOnly = !editableWeek(selected, week);
    const [lineup, matches, { data: entry }, previous, fixtures, standings] = await Promise.all([
      getLineup(supabase, member.id, selected),
      getWeekMatches(supabase, selected),
      supabase.from("game_weeks").select("total, bonus, final, pending").eq("owner_id", member.id).eq("week_start", selected).maybeSingle(),
      prevDay ? getLineup(supabase, member.id, prevDay) : Promise.resolve(undefined),
      getWeekFixtures(supabase, selected),
      getLatestSnapshots(supabase),
    ]);
    const paris = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...o }).format(new Date(iso));
    const fixtureRows: FixtureRow[] = fixtures.map((f) => {
      const snap = standings.get(f.teamId);
      return {
        id: f.id,
        day: paris(f.startsAt, { weekday: "short", day: "2-digit" }),
        time: paris(f.startsAt, { hour: "2-digit", minute: "2-digit" }).replace(":", "h"),
        teamName: f.teamName,
        teamRank: snap?.rank ?? null,
        opponent: f.opponent,
        opponentRank: snap ? opponentRank(snap.rows, f.opponent) : null,
        isHome: f.isHome,
      };
    });
    const now = new Date();
    const teamIds = [...new Set(cards.map((c) => c.teamId))];
    const nav = (day: string | null, label: string, text: string) =>
      day ? (
        <Link href={`/jeu?vue=equipe&journee=${day}`} className="chip" aria-label={label}>
          {text}
        </Link>
      ) : (
        <span className="chip is-disabled" aria-hidden="true">
          {text}
        </span>
      );
    content = (
      <>
        <div className="matchday-nav">
          {nav(prevDay, "Journée précédente", "‹")}
          <h2 className="lineup-title">
            {index >= 0 ? (
              <>
                Compo J{index + 1}
                <span className="lineup-dates">{matchdayDates(selected)}</span>
              </>
            ) : (
              "Pas encore de match au calendrier"
            )}
          </h2>
          {index >= 0 ? <WeekFixtures title={`J${index + 1}`} fixtures={fixtureRows} /> : <span />}
          {nav(nextDay, "Journée suivante", "›")}
        </div>
        {readOnly && entry && (
          <p className="pill">{entry.final ? "✓ Journée terminée" : "⏳ Points provisoires"} · {Number(entry.total)} pts</p>
        )}
        {readOnly && !entry && <p className="small muted">Pas d&apos;équipe validée pour cette journée.</p>}
        {!readOnly &&
          positionChanges(lineup, cards)
            .filter((c) => !isLocked(c.card.teamId, matches, now))
            .map((c) => (
              <p key={c.slot} className="pill">
                ⚠️ {shortName(c.card.firstName, c.card.lastName)} a changé de poste : il compte comme {GAME_POSITION_LABELS[c.from]} dans cette compo. Tu peux le garder ou le remplacer.
              </p>
            ))}
        {!readOnly && !!(entry?.pending as string[] | undefined)?.length && (
          <p className="pill">⏳ En attente du résultat : {(entry!.pending as string[]).join(", ")} (points provisoires)</p>
        )}
        <LineupEditor
          key={selected}
          week={selected}
          readOnly={readOnly}
          previous={previous}
          points={entry && !readOnly ? Number(entry.total) : null}
          owned={withFrozen(collection.map((e) => e.card), lineup)}
          initial={lineup}
          lockedTeams={teamIds.filter((t) => isLocked(t, matches, now))}
          playingTeams={[...new Set(matches.map((m) => m.teamId))]}
          validated={!!entry}
        />
      </>
    );
  } else if (tab === "boosters") {
    const daily = <DailyCard state={await getDailyState(supabase, member.id)} />;
    content = waiting ? (
      <>
        {daily}
        <BoosterOpening key={pending![0].id} label={pending![0].gift_cards ? `🎁 Cadeau · ${(pending![0].gift_cards as unknown[]).length} carte${(pending![0].gift_cards as unknown[]).length > 1 ? "s" : ""}` : "2 ou 3 joueurs"} remaining={waiting} open={openEarned.bind(null, pending![0].id as string)} />
      </>
    ) : (
      <>
      {daily}
      <div className="card stack booster-empty">
        <div className="booster-idle" aria-hidden="true">VUT</div>
        <p>Pas de booster à ouvrir. Tu en gagnes : en validant ton équipe chaque semaine, en finissant dans le top 3 de la semaine, tous les 3 entraînements où tu as répondu au sondage (à 22h après le 3e), et en venant aux événements.</p>
      </div>
      </>
    );
  } else if (tab === "classement") {
    content = <Ranking client={supabase} week={week} memberId={member.id} season={await getCurrentSeason(supabase)} />;
  } else {
    const { data: wallet } = await supabase.from("game_wallet").select("shards").eq("owner_id", member.id).maybeSingle();
    const shardCount = (wallet?.shards as number) ?? 0;
    let marketRows: { listings: ListingRow[]; offers: OfferRow[] } = { listings: [], offers: [] };
    if (market) {
      const since = new Date(Date.now() - LISTING_DAYS * 86_400_000).toISOString();
      const offerSince = new Date(Date.now() - OFFER_DAYS * 86_400_000).toISOString();
      const [{ data: ls }, { data: os }, { data: dir }] = await Promise.all([
        supabase.from("game_listings").select("*").eq("status", "open").gte("created_at", since).order("created_at", { ascending: false }),
        supabase.from("game_offers").select("*, listing:game_listings(member_id, team_id, kind, seller_id)").gte("created_at", offerSince).order("created_at", { ascending: false }),
        supabase.from("member_directory").select("id, first_name, last_name"),
      ]);
      const who = new Map((dir ?? []).map((m) => [m.id as string, shortName(m.first_name as string, m.last_name as string)]));
      const byKey = new Map(allCards.map((c) => [cardKey(c), c]));
      const find = (memberId: string | null, teamId: string | null, kind: string | null) =>
        memberId ? (byKey.get(cardKey({ memberId, teamId: teamId ?? "", kind: (kind ?? "common") as CardKind })) ?? null) : null;
      marketRows = {
        listings: (ls ?? []).flatMap((l) => {
          const card = find(l.member_id, l.team_id, l.kind);
          return card
            ? [{ id: l.id, seller: who.get(l.seller_id) ?? "?", mine: l.seller_id === member.id, card, askShards: l.ask_shards, askCard: find(l.ask_member_id, l.ask_team_id, l.ask_kind), createdAt: l.created_at }]
            : [];
        }),
        offers: (os ?? []).map((o) => {
          const l = o.listing as { member_id: string; team_id: string; kind: string; seller_id: string } | null;
          return {
            id: o.id,
            listingId: o.listing_id,
            buyer: who.get(o.buyer_id) ?? "?",
            shards: o.shards,
            cards: ((o.cards as { memberId: string; teamId: string; kind: string }[]) ?? []).flatMap((c) => find(c.memberId, c.teamId, c.kind) ?? []),
            status: o.status,
            card: l ? find(l.member_id, l.team_id, l.kind) : null,
            mine: o.buyer_id === member.id,
            fromSeller: !!o.from_seller,
            round: (o.round as number) ?? 1,
          };
        }),
      };
    }
    content = market ? (
      <div className="stack">
        <div className="market-head">
          <Link href="/jeu?vue=collection" className="back">← Album</Link>
          <h2>🔁 Marché</h2>
        </div>
        <MarketView
          listings={marketRows.listings}
          offers={marketRows.offers}
          owned={collection}
          all={allCards}
          shards={shardCount}
          sellKey={vendre}
          bank={<CollectionView entries={collection} all={allCards} shards={shardCount} bank />}
        />
      </div>
    ) : (
      <CollectionView entries={collection} all={allCards} shards={(wallet?.shards as number) ?? 0} />
    );
  }

  return (
    <main className="page stack vut-page">
      {header}
      <nav className="game-tabs" aria-label="VUT">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/jeu?vue=${k}`} aria-current={tab === k ? "page" : undefined}>
            {label}
            {k === "boosters" && waiting > 0 && (
              <span className="chat-badge" aria-label={`${waiting} à ouvrir`}>
                {waiting}
              </span>
            )}
          </Link>
        ))}
      </nav>
      {content}
      <Link href="/jeu/regles" className="card card-link rules-link">
        📖 <strong>Règles du jeu</strong> <span className="small muted">cartes, raretés, points, bonus, boosters</span>
      </Link>
      {tools}
    </main>
  );
}
