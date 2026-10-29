import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { getEvents } from "@/lib/events";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Événements" };

export default async function EvenementsPage({ searchParams }: { searchParams: Promise<{ passes?: string }> }) {
  const past = (await searchParams).passes === "1";
  const isBoard = hasRole(await getCurrentMember(), "board");
  const events = await getEvents(await createClient(), { past });

  return (
    <main className="page stack">
      <h1>Événements</h1>
      {isBoard && (
        <Link href="/bureau/evenements" className="btn-secondary center">
          Créer ou modifier un événement
        </Link>
      )}
      <Link href={past ? "/evenements" : "/evenements?passes=1"} className="small">
        {past ? "← Événements à venir" : "Voir les événements passés"}
      </Link>
      {events.length ? (
        <ul className="list">{events.map((e) => <EventCard key={e.id} event={e} showVisibility={isBoard} />)}</ul>
      ) : (
        <p className="notice">{past ? "Aucun événement passé." : "Aucun événement prévu pour l'instant."}</p>
      )}
    </main>
  );
}
