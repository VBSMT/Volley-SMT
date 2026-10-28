import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentMember } from "@/lib/member";

export const metadata: Metadata = { title: "Accueil" };

export default async function AccueilPage() {
  const member = (await getCurrentMember())!;

  return (
    <main className="page stack">
      <h1>Bonjour {member.first_name}</h1>
      <section className="card stack">
        <h2>Prochain entraînement</h2>
        <p className="muted">Le sondage de présence arrive bientôt.</p>
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
