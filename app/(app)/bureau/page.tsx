import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ZelsyncFooter } from "@/components/ZelsyncFooter";
import { getCurrentMember, hasRole } from "@/lib/member";

export const metadata: Metadata = { title: "Bureau" };

// [titre, description, lien si la section existe déjà]
const SECTIONS: [string, string, string?][] = [
  ["Calendrier des matchs", "Import du fichier Excel du club", "/bureau/matchs"],
  ["Adhérents", "Import Excel/CSV, comptes et invitations, liste des adhérents", "/bureau/adherents"],
  ["Gymnase", "Séances de la saison, ouverture des terrains (vacances, fériés)", "/bureau/gymnase"],
  ["Compo du soir", "Équipes générées à 12h, ajustement des présents", "/bureau/compo"],
  ["Reports", "Demandes en attente, décisions et historique", "/bureau/reports"],
  ["Événements", "Création, visibilité par rôle, sondages de présence et de bénévolat", "/bureau/evenements"],
  ["Annonces", "Message au club, à une équipe, aux bénévoles ou aux inscrits d'une séance", "/bureau/annonces"],
  ["Saison", "Licences, cotisations, relances, exports CSV", "/bureau/saison"],
  ["Liens utiles", "volley34, FSGT, documents (visibles par tous)", "/bureau/liens"],
  ["Paramètres", "Horaires de notification et de clôture, expiration des reports, équipes", "/bureau/parametres"],
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
