import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnouncementList } from "@/components/AnnouncementList";
import { getAnnouncements } from "@/lib/announcements";
import { formatDay } from "@/lib/format";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { getSessions } from "@/lib/training";
import { AnnouncementForm } from "./AnnouncementForm";

export const metadata: Metadata = { title: "Annonces" };

export default async function BureauAnnoncesPage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  const supabase = await createClient();
  const [{ data: teams }, sessions, items] = await Promise.all([
    supabase.from("teams").select("id, name").order("name"),
    getSessions({ from: new Date(Date.now() - 2 * 3600_000), limit: 8 }),
    getAnnouncements(supabase, { limit: 30 }),
  ]);

  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Annonces</h1>
      <AnnouncementForm
        teams={teams ?? []}
        sessions={sessions
          .filter((s) => s.freeCourts > 0)
          .map((s) => ({ id: s.id, label: `${formatDay(s.startsAt)} · ${s.present.length} inscrits` }))}
      />
      <section className="stack">
        <h2>Annonces publiées</h2>
        {items.length ? <AnnouncementList items={items} canDelete /> : <p className="muted small">Aucune annonce.</p>}
      </section>
    </main>
  );
}
