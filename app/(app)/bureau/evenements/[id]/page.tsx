import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { EventType, Role } from "@/lib/domain/events";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "Modifier l'événement" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: e }, { data: needs }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("event_volunteer_needs").select("label, needed").eq("event_id", id).order("label"),
  ]);
  if (!e) notFound();
  const local = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", ...opts }).format(new Date(e.starts_at));

  return (
    <main className="page stack">
      <Link href={`/evenements/${id}`} className="back">← Événement</Link>
      <h1>Modifier l&apos;événement</h1>
      <EventForm
        values={{
          id,
          type: e.type as EventType,
          title: e.title,
          date: local({ year: "numeric", month: "2-digit", day: "2-digit" }),
          time: local({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
          location: e.location ?? "",
          description: e.description ?? "",
          visibleRoles: (e.visible_roles ?? []) as Role[],
          attendancePoll: e.attendance_poll,
          askPartner: e.ask_partner,
          askChildren: e.ask_children,
          askGuests: e.ask_guests,
          volunteerPoll: e.volunteer_poll,
          needs: needs ?? [],
        }}
      />
    </main>
  );
}
