import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Aide" };

/** Aide (publique, lisible sans être connecté : lien envoyé avec l'invitation). */
export default function AidePage() {
  return (
    <main className="page stack aide">
      <Link href="/accueil" className="back">← Volley SMT</Link>
      <h1>Aide</h1>
      <p className="muted">L&apos;appli du club : entraînements, matchs, renforts, événements. Gratuite, sans publicité.</p>

      <details open>
        <summary><h2>1. Se connecter</h2></summary>
        <ol>
          <li>Ouvrez <strong>volley-smt.vercel.app</strong> et saisissez <strong>l&apos;email donné au club</strong>.</li>
          <li>Vous recevez un email avec un <strong>code</strong> : tapez-le dans l&apos;appli.</li>
          <li>Pas de mot de passe. Pas d&apos;email ? Regardez dans les indésirables, ou demandez au Bureau
            quelle adresse a été enregistrée.</li>
        </ol>
        <p className="muted small">Astuce : le code est plus fiable que le lien du mail, surtout une fois l&apos;appli installée.</p>
      </details>

      <details open>
        <summary><h2>2. Installer l&apos;appli</h2></summary>
        <h3>iPhone / iPad</h3>
        <ol>
          <li>Ouvrez le site dans <strong>Safari</strong>.</li>
          <li>Touchez <strong>Partager</strong> (carré avec une flèche vers le haut).</li>
          <li>Choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong>, puis <strong>Ajouter</strong>.</li>
          <li>Ouvrez ensuite Volley SMT <strong>depuis l&apos;icône</strong> (indispensable pour les notifications, iOS 16.4 minimum).</li>
        </ol>
        <h3>Android</h3>
        <ol>
          <li>Ouvrez le site dans <strong>Chrome</strong>.</li>
          <li>Touchez <strong>Installer</strong> sur l&apos;accueil de l&apos;appli, ou le menu ⋮ puis <strong>« Installer l&apos;application »</strong>.</li>
        </ol>
      </details>

      <details>
        <summary><h2>3. Compléter son profil</h2></summary>
        <p>Touchez vos initiales en haut à droite :</p>
        <ul>
          <li><strong>Postes</strong> (passe, avant, fond) : poste 1 et poste 2, utilisés pour faire des équipes équilibrées à l&apos;entraînement.</li>
          <li><strong>Téléphone</strong> et <strong>contact d&apos;urgence</strong>.</li>
          <li><strong>Droit à l&apos;image</strong> (photos du club).</li>
          <li>Vérifiez nom, équipe(s), licence et cotisation : en cas d&apos;erreur, prévenez le Bureau.</li>
        </ul>
      </details>

      <details>
        <summary><h2>4. Notifications</h2></summary>
        <ul>
          <li>Activez-les sur l&apos;accueil ou dans le profil, puis acceptez la demande du téléphone. À refaire sur chaque appareil.</li>
          <li>Choisissez dans le profil ce que vous recevez : entraînements (la veille à 20h), matchs de votre équipe (2 jours avant), demandes de renfort.</li>
          <li>Sans notifications activées, les messages arrivent par email.</li>
        </ul>
      </details>

      <details>
        <summary><h2>5. Entraînements</h2></summary>
        <ul>
          <li>Mardi et jeudi 20h–22h. Répondez <strong>Je viens / Je ne viens pas</strong>, autant de séances à l&apos;avance que vous voulez.</li>
          <li>Le sondage ferme <strong>le jour même</strong> à l&apos;heure indiquée sur la page Entraînements (12h par défaut) ; les équipes sont faites par le Bureau à partir des présents.</li>
          <li>La veille, une seule notification : une question si vous n&apos;avez pas répondu, un rappel si vous venez.</li>
        </ul>
      </details>

      <details>
        <summary><h2>6. Matchs, renforts, événements</h2></summary>
        <ul>
          <li><strong>Matchs</strong> : calendrier de votre équipe (mis à jour chaque jour depuis volley34), lien <strong>Itinéraire</strong> pour les matchs à l&apos;extérieur, disponibilités demandées par le capitaine.</li>
          <li><strong>Renforts</strong> : quand une équipe cherche un joueur, la demande s&apos;affiche sur l&apos;accueil ; touchez <strong>Je peux aider</strong>.</li>
          <li><strong>Événements</strong> : tournois, repas… répondez au sondage de présence.</li>
          <li><strong>Stats</strong> : classement et résultats de chaque équipe du club.</li>
        </ul>
      </details>

      <details>
        <summary><h2>Sans réseau</h2></summary>
        <p>Les pages déjà consultées sur l&apos;appareil restent lisibles hors ligne (dernière version). Pour répondre à un sondage, il faut du réseau.</p>
      </details>

      <details>
        <summary><h2>Vos données</h2></summary>
        <p>
          Données hébergées dans l&apos;Union européenne, utilisées uniquement par le club. Aucune donnée médicale.
          Les fiches sont supprimées 2 ans après la dernière adhésion. Pour toute question ou correction : le Bureau.
        </p>
      </details>
    </main>
  );
}
