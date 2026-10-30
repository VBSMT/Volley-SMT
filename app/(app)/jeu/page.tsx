import type { Metadata } from "next";
import { PlayerCard } from "@/components/game/PlayerCard";
import { GAME_POSITIONS, GAME_POSITION_LABELS, STARTER_SIZE } from "@/lib/domain/game";
import { getCollection, getGameCards, starterOpened } from "@/lib/game";
import { notFound } from "next/navigation";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { BoosterOpening } from "./BoosterOpening";

export const metadata: Metadata = { title: "VUT" };

/** VUT (Volley Ultimate Team), réservé au Bureau pour l'instant : ouverture du booster de départ, puis collection. */
export default async function JeuPage() {
  const member = (await getCurrentMember())!;
  if (!hasRole(member, "board")) notFound();
  const supabase = await createClient();
  const cards = await getGameCards(supabase);
  const opened = await starterOpened(supabase, member.id);
  const collection = opened ? await getCollection(supabase, cards) : [];

  return (
    <main className="page stack">
      <h1>VUT <span className="small muted">Volley Ultimate Team</span></h1>
      {!opened ? (
        <>
          <p>Bienvenue ! Ouvre ton premier booster : {STARTER_SIZE} joueurs du club, dont au moins un par poste.</p>
          <BoosterOpening size={STARTER_SIZE} />
        </>
      ) : (
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
                      <li key={`${e.card.memberId}:${e.card.teamId}`} className="pcard-slot">
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
      )}
      <details className="card">
        <summary>Comment ça marche ?</summary>
        <ul>
          <li>Une carte = un joueur dans une équipe du club, à son poste 1. Un joueur de deux équipes a deux cartes.</li>
          <li>
            La note (40 à 99) est la forme de l&apos;équipe : moyenne de ses 5 derniers matchs (3-0 → 10 points, 3-1 → 8, 3-2 → 6,
            2-3 → 3, 1-3 → 1, 0-3 → 0), 60 avant le premier match. Elle est mise à jour chaque matin.
          </li>
          <li>Bandeau or à partir de 80, argent de 65 à 79, bronze en dessous.</li>
          <li>Pas de carte sans poste renseigné : complète le tien dans ton profil. Ta photo s&apos;ajoute aussi depuis le profil.</li>
          <li>Bientôt : composer ton équipe de la semaine (4 titulaires et un remplaçant), gagner des boosters et le classement.</li>
        </ul>
      </details>
    </main>
  );
}
