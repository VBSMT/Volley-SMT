import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STARTER_SIZE } from "@/lib/domain/game";
import { isLocked } from "@/lib/domain/game-week";
import { getCollection, getGameCards, starterOpened } from "@/lib/game";
import { currentWeek, getLineup, getWeekMatches } from "@/lib/game-week";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { openEarned, openStarter } from "./actions";
import { BoosterOpening } from "./BoosterOpening";
import { CollectionCarousel } from "./CollectionCarousel";
import { LineupEditor } from "./LineupEditor";
import { Ranking } from "./Ranking";
import { TestTools } from "./TestTools";

export const metadata: Metadata = { title: "VUT" };

const TABS = [
  ["equipe", "Équipe"],
  ["boosters", "Boosters"],
  ["collection", "Collection"],
  ["classement", "Classement"],
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
  const waiting = pending?.length ?? 0;

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
        <LineupEditor
          points={entry ? Number(entry.total) : null}
          owned={collection.map((e) => e.card)}
          initial={lineup}
          lockedTeams={teamIds.filter((t) => isLocked(t, matches, now))}
          playingTeams={[...new Set(matches.map((m) => m.teamId))]}
          validated={!!entry}
        />
      </>
    );
  } else if (tab === "boosters") {
    content = waiting ? (
      <>
        <p>
          {waiting} booster{waiting > 1 ? "s" : ""} à ouvrir.
        </p>
        <BoosterOpening key={pending![0].id} label="2 ou 3 joueurs" open={openEarned.bind(null, pending![0].id as string)} />
      </>
    ) : (
      <div className="card stack booster-empty">
        <div className="booster-idle" aria-hidden="true">VUT</div>
        <p>Pas de booster à ouvrir. Tu en gagnes en validant ton équipe chaque semaine, en finissant dans le top 3, en répondant au sondage de 3 entraînements et en venant aux événements.</p>
      </div>
    );
  } else if (tab === "classement") {
    content = <Ranking client={supabase} week={week} memberId={member.id} />;
  } else {
    content = <CollectionCarousel entries={collection} total={cards.length} />;
  }

  return (
    <main className="page stack">
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
      <details className="card">
        <summary>Comment ça marche ?</summary>
        <ul>
          <li>Chaque semaine (lundi–dimanche), aligne 4 titulaires (passe, Avant (4), Avant (2), fond) et un remplaçant de n&apos;importe quel poste, avec au moins une fille parmi les titulaires et au plus 2 joueurs d&apos;une même équipe.</li>
          <li>Sur le terrain : glisse ta main pour la faire tourner, touche la carte du centre pour la poser à son poste, ou glisse-la vers le haut jusqu&apos;à une place. Touche une place vide pour ne voir que les cartes de ce poste ; touche une carte posée pour la remettre en main. La case « Remplaçant » dans le coin compte à 50 %.</li>
          <li>Une carte se verrouille au début du match de son équipe.</li>
          <li>Points selon le résultat de l&apos;équipe : 3-0 → 10, 3-1 → 8, 3-2 → 6, 2-3 → 3, 1-3 → 1, 0-3 → 0.</li>
          <li>Bonus : passe +1 par set gagné ; avant +1 par tranche de 10 points d&apos;écart (au plus +4) ; fond +1 par set où l&apos;équipe encaisse moins de 20 points.</li>
          <li>Le remplaçant compte à 50 %, ou à 100 % s&apos;il remplace un titulaire dont l&apos;équipe n&apos;a pas joué.</li>
          <li>La note (40–99) est la forme de l&apos;équipe sur ses 5 derniers matchs (60 au départ) ; bandeau or ≥ 80, argent 65–79, bronze en dessous.</li>
          <li>Classement : points, puis bonus, puis équipe validée le plus tôt.</li>
        </ul>
      </details>
      {tools}
    </main>
  );
}
