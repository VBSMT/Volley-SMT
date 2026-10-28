import type { Metadata } from "next";
import Link from "next/link";
import { SessionCard } from "@/components/SessionCard";
import { getCurrentMember } from "@/lib/member";
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

  return (
    <main className="page stack">
      <h1>Bonjour {member.first_name}</h1>
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
