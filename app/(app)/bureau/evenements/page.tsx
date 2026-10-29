import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/EventCard";
import { getEvents } from "@/lib/events";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "./EventForm";

export const metadata: Metadata = { title: "Événements · Bureau" };

export default async function BureauEventsPage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  const events = await getEvents(await createClient());
  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Événements</h1>
      {events.length > 0 && (
        <section className="stack">
          <h2>À venir</h2>
          <ul className="list">{events.map((e) => <EventCard key={e.id} event={e} showVisibility />)}</ul>
        </section>
      )}
      <h2>Nouvel événement</h2>
      <EventForm
        values={{
          id: null, type: "members_meal", title: "", date: "", time: "19:00", location: "", description: "",
          visibleRoles: [], attendancePoll: true, askPartner: false, askChildren: false, askGuests: false,
          volunteerPoll: false, needs: [],
        }}
      />
    </main>
  );
}
