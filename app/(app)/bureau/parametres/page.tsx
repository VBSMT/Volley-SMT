import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember, hasRole } from "@/lib/member";
import { getSchedule } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { ScheduleForm } from "./ScheduleForm";
import { TeamsEditor } from "./TeamsEditor";

export const metadata: Metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  const supabase = await createClient();
  const [schedule, { data: teams }] = await Promise.all([
    getSchedule(supabase, "table"),
    supabase.from("teams").select("id, name, volley34_ref").order("name"),
  ]);
  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Paramètres</h1>
      <ScheduleForm schedule={schedule} />
      <TeamsEditor teams={(teams ?? []).map((t) => ({ id: t.id, name: t.name, code: t.volley34_ref }))} />
      <section className="card stack">
        <h2>Autres réglages</h2>
        <p className="small">
          <strong>Échelle de niveau</strong> : 1 à 5 (fixée en base ; la changer demande une évolution de l&apos;appli).
        </p>
        <p className="small">
          <strong>Synchro volley34</strong> : état et synchro manuelle dans{" "}
          <Link href="/bureau/matchs" className="match-link">Calendrier des matchs</Link>.
        </p>
        <p className="small">
          <strong>Ouverture des terrains</strong> : dans <Link href="/bureau/gymnase" className="match-link">Gymnase</Link>.
        </p>
      </section>
    </main>
  );
}
