import type { Metadata } from "next";
import { AnnouncementList } from "@/components/AnnouncementList";
import { getAnnouncements } from "@/lib/announcements";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Annonces" };

export default async function AnnoncesPage() {
  const items = await getAnnouncements(await createClient(), { limit: 50 });
  return (
    <main className="page stack">
      <h1>Annonces</h1>
      {items.length ? <AnnouncementList items={items} /> : <p className="notice">Aucune annonce pour l&apos;instant.</p>}
    </main>
  );
}
