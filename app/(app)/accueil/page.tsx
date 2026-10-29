import type { Metadata } from "next";
import Link from "next/link";
import { NotificationToggle } from "@/components/NotificationToggle";
import { ReinforcementCard } from "@/components/ReinforcementCard";
import { SessionCard } from "@/components/SessionCard";
import { captainTeamIds, getCurrentMember, hasRole } from "@/lib/member";
import { getOpenReinforcements } from "@/lib/reinforcements";
import { getSessions } from "@/lib/training";

export const metadata: Metadata = { title: "Accueil" };

export default async function AccueilPage() {
  const member = (await getCurrentMember())!;
  // Prochaine séance avec au moins un terrain libre.
  const upcoming = await getSessions({
    from: new Date(Date.now() - 2 * 3600_000),
    limit: 10,
    memberId: member.id,
  });
  const next = upcoming.find((s) => s.freeCourts > 0);
  const myCaptainTeams = captainTeamIds(member);
  const reinforcements = await getOpenReinforcements({
    memberId: member.id,
    isBoard: hasRole(member, "board"),
    captainTeamIds: myCaptainTeams,
  });

  return (
    <main className="page stack">
      <h1>Bonjour {member.first_name}</h1>
      <NotificationToggle compact />
      {reinforcements.length > 0 && (
        <section className="stack">
          <h2>Renforts recherchés</h2>
          <ul className="list">
            {reinforcements.map((r) => (
              <ReinforcementCard key={r.id} request={r} myTeamId={member.team_id} />
            ))}
          </ul>
        </section>
      )}
      {myCaptainTeams.length > 0 && (
        <Link href="/renforts/nouveau" className="btn-secondary center">
          Demander un renfort pour mon équipe
        </Link>
      )}

      <section className="stack">
        <h2>Prochain entraînement</h2>
        {next ? (
          <ul className="list">
            <SessionCard session={next} />
          </ul>
        ) : (
          <p className="notice">Aucun entraînement programmé prochainement.</p>
        )}
        <Link href="/entrainements" className="small">
          Toutes les séances →
        </Link>
      </section>
      <section className="card stack">
        <h2>Prochain événement</h2>
        <p className="muted">Aucun événement prévu pour l&apos;instant.</p>
      </section>
      {!member.phone && (
        <Link href="/profil" className="notice">
          Complétez votre profil : téléphone, contact d&apos;urgence, postes.
        </Link>
      )}
    </main>
  );
}
