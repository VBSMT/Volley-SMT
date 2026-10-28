import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ZelsyncFooter } from "@/components/ZelsyncFooter";
import { getCurrentMember, hasRole } from "@/lib/member";

export const metadata: Metadata = { title: "Bureau" };

// [titre, description, lien si la section existe déjà]
const SECTIONS: [string, string, string?][] = [
  ["Calendrier des matchs", "Import du fichier Excel du club", "/bureau/matchs"],
  ["Adhérents", "Import CSV, invitations, niveaux, rôles, équipes, demandes bénévoles"],
  ["Gymnase", "Ouverture des créneaux pendant les vacances et jours fériés"],
  ["Compo du soir", "Équipes générées après la clôture du sondage"],
  ["Reports", "Demandes en attente et historique"],
  ["Annonces", "Message au club, à une équipe, aux bénévoles"],
  ["Saison", "Licences, cotisations, relances, exports"],
  ["Liens utiles", "volley34, FSGT, documents"],
  ["Paramètres", "Équipes, échelle de niveau, horaires, synchro"],
];

export default async function BureauPage() {
  // Les données sont protégées par la RLS ; on masque aussi l'écran aux non-Bureau.
  if (!hasRole(await getCurrentMember(), "board")) notFound();

  return (
    <main className="page stack">
      <h1>Bureau</h1>
      <ul className="list">
        {SECTIONS.map(([title, desc, href]) =>
          href ? (
            <li key={title}>
              <Link href={href} className="card card-link">
                <h2>{title} →</h2>
                <p className="muted small">{desc}</p>
              </Link>
            </li>
          ) : (
            <li key={title} className="card">
              <h2>{title}</h2>
              <p className="muted small">{desc} — bientôt.</p>
            </li>
          ),
        )}
      </ul>
      <ZelsyncFooter />
    </main>
  );
}
