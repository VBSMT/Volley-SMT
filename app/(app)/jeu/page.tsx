import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerCard } from "@/components/game/PlayerCard";
import { GAME_POSITIONS, GAME_POSITION_LABELS, STARTER_SIZE, cardKey } from "@/lib/domain/game";
import { isLocked } from "@/lib/domain/game-week";
import { getCollection, getGameCards, starterOpened } from "@/lib/game";
import { currentWeek, getLineup, getWeekMatches } from "@/lib/game-week";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { openEarned, openStarter } from "./actions";
import { BoosterOpening } from "./BoosterOpening";
import { LineupEditor } from "./LineupEditor";
import { Ranking } from "./Ranking";
import { TestTools } from "./TestTools";

export const metadata: Metadata = { title: "VUT" };

const TABS = [
  ["equipe", "Mon équipe"],
  ["classement", "Classement"],
  ["collection", "Collection"],
] as const;
type Tab = (typeof TABS)[number][0];

/** VUT (Volley Ultimate Team), réservé au Bureau pour l'instant. */
export default async function JeuPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const member = (await getCurrentMember())!;
  if (!hasRole(member, "board")) notFound();
  const { vue } = await searchParams;
  const tab: Tab = TABS.some(([k]) => k === vue) ? (vue as Tab) : "equipe";

  const supabase = await createClient();
  const [cards, opened, { data: teams }] = await Promise.all([
    getGameCards(supabase),
    starterOpened(supabase, member.id),
    supabase.from("teams").select("id, name").order("name"),
  ]);

  const header = (
    <h1>
      VUT <span className="small muted">Volley Ultimate Team</span>
    </h1>
  );
  const tools = <TestTools teams={teams ?? []} />;

  if (!opened) {
    return (
      <main className="page stack">
        {header}
        <p>Bienvenue ! Ouvre ton premier booster : {STARTER_SIZE} joueurs du club, dont au moins un par poste.</p>
        <BoosterOpening label={`${STARTER_SIZE} joueurs`} open={openStarter} starter />
        {tools}
      </main>
    );
  }

  const { data: pending } = await supabase.from("game_boosters").select("id").eq("kind", "earned").is("opened_at", null).order("created_at");
  if (pending?.length) {
    return (
      <main className="page stack">
        {header}
        <p>
          Tu as {pending.length} booster{pending.length > 1 ? "s" : ""} à ouvrir.
        </p>
        <BoosterOpening key={pending[0].id} label="2 ou 3 joueurs" open={openEarned.bind(null, pending[0].id as string)} />
        {tools}
      </main>
    );
  }

  const collection = await getCollection(supabase, cards);
  const week = currentWeek();

  let content: React.ReactNode;
  if (tab === "equipe") {
    const [lineup, matches, { data: entry }] = await Promise.all([
      getLineup(supabase, member.id, week),
      getWeekMatches(supabase, week),
      supabase.from("game_weeks").select("total, bonus, computed_at").eq("owner_id", member.id).eq("week_start", week).maybeSingle(),
    ]);
    const now = new Date();
    const teamIds = [...new Set(cards.map((c) => c.teamId))];
    content = (
      <>
        {entry && (
          <p className="card">
            Points provisoires de la semaine : <strong>{Number(entry.total)}</strong> (dont {Number(entry.bonus)} de bonus)
          </p>
        )}
        <LineupEditor
          owned={collection.map((e) => e.card)}
          initial={lineup}
          lockedTeams={teamIds.filter((t) => isLocked(t, matches, now))}
          playingTeams={[...new Set(matches.map((m) => m.teamId))]}
          validated={!!entry}
        />
      </>
    );
  } else if (tab === "classement") {
    content = <Ranking client={supabase} week={week} memberId={member.id} />;
  } else {
    content = (
      <>
        <p className="small">
          {collection.length} carte{collection.length > 1 ? "s" : ""} sur {cards.length} dans le club.
        </p>
        {GAME_POSITIONS.map((p) => {
          const mine = collection.filter((e) => e.card.position === p).sort((a, b) => b.card.rating - a.card.rating);
          return (
            <section key={p} className="stack">
              <h2>{GAME_POSITION_LABELS[p]}</h2>
              {mine.length ? (
                <ul className="game-grid" role="list">
                  {mine.map((e) => (
                    <li key={cardKey(e.card)} className="pcard-slot">
                      <PlayerCard card={e.card} copies={e.copies} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small">Aucune carte à ce poste pour l&apos;instant.</p>
              )}
            </section>
          );
        })}
      </>
    );
  }

  return (
    <main className="page stack">
      {header}
      <nav className="game-tabs" aria-label="VUT">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/jeu?vue=${k}`} aria-current={tab === k ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {content}
      <details className="card">
        <summary>Comment ça marche ?</summary>
        <ul>
          <li>Chaque semaine (lundi–dimanche), aligne 4 titulaires (passe, Avant (4), Avant (2), fond) et un remplaçant de n&apos;importe quel poste, avec au moins une fille parmi les titulaires et au plus 2 joueurs d&apos;une même équipe.</li>
          <li>Une carte se verrouille au début du match de son équipe.</li>
          <li>Points selon le résultat de l&apos;équipe : 3-0 → 10, 3-1 → 8, 3-2 → 6, 2-3 → 3, 1-3 → 1, 0-3 → 0.</li>
          <li>Bonus : passe +1 par set gagné ; avant +1 par tranche de 10 points d&apos;écart ; fond +2 si l&apos;équipe encaisse 20 points ou moins par set.</li>
          <li>Le remplaçant compte à 50 %, ou à 100 % s&apos;il remplace un titulaire dont l&apos;équipe n&apos;a pas joué.</li>
          <li>La note (40–99) est la forme de l&apos;équipe sur ses 5 derniers matchs (60 au départ) ; bandeau or ≥ 80, argent 65–79, bronze en dessous.</li>
          <li>Classement : points, puis bonus, puis équipe validée le plus tôt.</li>
        </ul>
      </details>
      {tools}
    </main>
  );
}
