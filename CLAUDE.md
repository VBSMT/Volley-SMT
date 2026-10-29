# Volley SMT — outil interne du club

Application web (PWA) de gestion du club **Volley-Ball Loisirs Saint-Mathieu-de-Tréviers** (FSGT 34, ~70 adhérents).
Nom affiché : **Volley SMT**. Pied de page « Propulsé par Zelsync » (lien https://zelsync.fr) sur l'écran de connexion, le profil et l'onglet Bureau uniquement.

Développeur unique : Benjamin (Windows + VS Code). Langue de l'interface, du code métier et des commentaires : **français**. Noms de tables/colonnes en anglais snake_case.

## Contraintes globales
- **Coût 0 €** : offres gratuites uniquement. Ne jamais ajouter un service payant sans le signaler.
- **RGPD** : données hébergées en UE. Aucune donnée médicale. Niveau des joueurs visible **Bureau uniquement**. Fiches supprimées 2 ans après la dernière adhésion ; niveaux supprimés dès la fin de l'adhésion.
- Tous les comptes de service (Supabase, Vercel, Brevo, GitHub) appartiennent au club, pas à une personne.
- Mobile d'abord (390 px), cibles tactiles ≥ 44 px, accessible (vrais `<button>`, `<label>`, contrastes AA).

## Stack
- **Front** : Next.js (App Router, TypeScript), PWA (`short_name: "Volley SMT"`, icône carrée fond noir), déployé sur Vercel.
- **Back** : Supabase (Postgres, Auth, RLS, Edge Functions, pg_cron), région UE.
- **Auth** : lien magique uniquement. Inscription libre **désactivée** : seuls les comptes importés par le Bureau existent.
- **Emails** : SMTP Brevo. **Push** : Web Push (VAPID), email en secours.
- Schéma versionné : **toute évolution de la base passe par une migration** dans `supabase/migrations/`. Jamais de modif manuelle dans le dashboard.
- Secrets dans les variables d'environnement. La clé `service_role` reste côté serveur.

## Charte
Noir `#111111`, jaune `#FFE81A`, gris `#BDBDBD`, fond `#F4F4F2`. Titres Barlow Condensed 700, texte Barlow. Logo du club en en-tête. Barre d'onglets en bas.

## Rôles (cumulables)
Une personne a 1..N rôles. `captain` est rattaché à une équipe précise. Chaque adhérent a **0 ou 1 équipe**.

| Rôle | Onglets |
|---|---|
| Adhérent | Accueil, Entraînements, Matchs, Événements (4) |
| Capitaine | idem + demander un report ou un **renfort** pour **les matchs de son équipe** |
| Bénévole | idem + sondages de participation bénévole |
| Bureau | 5 onglets : + onglet **Bureau** ; tout gérer |

Les droits sont appliqués **en base via RLS**, pas seulement dans l'UI. Tester chaque rôle avec un compte de test.

## Fiche adhérent
- Modifiable par l'adhérent : téléphone, contact d'urgence, droit à l'image, poste 1 et poste 2 (passe / avant / fond).
- Lecture seule pour lui : nom, prénom, email (sert à la connexion), équipe, rôles, licence FSGT + saison, cotisation réglée, sexe.
- Invisible pour lui : niveau (table séparée `member_levels`, Bureau seulement).
- Demande « Devenir bénévole » depuis le profil : confirmation, puis demande envoyée au Bureau qui valide ou refuse.
- **Notifications choisies dans le profil** (toutes activées par défaut) : entraînements (J-1), matchs de mon équipe (J-2), demandes de renfort. Désactiver un type coupe ce message en push **et** en email. Activation du push par appareil.

## Séances d'entraînement
- Gymnase : 3 terrains. Créneaux : **tous les mardis et jeudis 20h–22h** de la saison.
- Vacances scolaires (zone C) et jours fériés : **0 terrain disponible par défaut**. Le Bureau peut rouvrir 1 à 3 terrains sur un créneau.
- Terrains libres d'une séance = terrains ouverts − matchs à domicile − pré-réservations de report validées.

## Sondage de présence
- Ouvert en permanence pour toutes les séances à venir ; un adhérent peut répondre plusieurs séances d'avance.
- **Nominatif** : tout adhérent voit qui vient et le nombre d'inscrits.
- **Une seule notif par personne, à J-1 à 20h** (lundi pour mardi, mercredi pour jeudi ; heure réglable dans Paramètres), seulement si la séance a au moins 1 terrain libre :
  - **non-répondants** : la demande (« Entraînement demain 20h–22h — tu viens ? Réponds avant 12h demain. »), ouvre le sondage ;
  - **inscrits présents** : un rappel (« N'oublie pas : entraînement demain 20h–22h, X inscrits »).
  - Rien pour ceux qui ont répondu « je ne viens pas ». Pas d'autre relance.
- Envoi en **push** (Web Push) ; **email** (Brevo) en secours pour ceux qui n'ont pas activé les notifications.
- **Clôture à 12h le jour J**, puis : génération de la compo, puis notif au Bureau « compo prête, X présents, Y terrains ».
- La compo est visible **Bureau uniquement**. Les ajustements de dernière minute se font sur place.

## Algorithme de composition
Entrées : présents (sexe, niveau, poste 1, poste 2), T = terrains libres.

**Étape 1, nombre d'équipes n** :
- Maximiser les terrains occupés ; équipes de 4 à 6 ; une équipe au repos (rotation) seulement si elle compte ≥ 4 joueurs ; à terrains égaux, préférer la rotation (équipes de 4).
- Si P > 6 × (2T + 1) : n = 2T + 1, taille sans limite (débordement).
- Sinon, pour t de T à 1 : si 4(2t+1) ≤ P ≤ 6(2t+1) → n = 2t+1 ; sinon si 8t ≤ P ≤ 12t → n = 2t.
- Si P < 8 : n = 2, alerte Bureau.
- Tailles : P réparti en n équipes, écart max de 1.

Exemples (T = 3) : 9 → 2 équipes (4+5) ; 12 → 3×4 en rotation ; 16 → 4×4 ; 20 → 5×4 en rotation ; 23 → 5 équipes (5,5,5,4,4) ; 28 → 7×4 ; 50 → 7 équipes de 7–8.

**Étape 2, répartition**, contraintes de la plus forte à la plus faible :
1. niveaux équilibrés (sommes de niveaux les plus proches) ;
2. ≥ 1 fille par équipe ; s'il y a moins de filles que d'équipes, au plus 1 par équipe ;
3. ≥ 1 passeur par équipe ;
4. joueurs sur leur poste 1 plutôt que poste 2 ;
5. ≥ 1 joueur de fond par équipe.

Méthode : répartition initiale en serpent par niveau décroissant, puis échanges entre équipes tant qu'un échange réduit un coût pondéré (poids décroissants dans l'ordre ci-dessus). Chaque contrainte non tenue est remontée au Bureau. Fonction pure, testée unitairement avec les exemples ci-dessus.

## Calendrier des matchs
- Source officielle : **volley34.fr** (championnat et coupe FSGT 34). **Accord de la commission obtenu** pour la lecture (octobre 2026) :
  - calendrier : flux ICS par équipe `http://calendrier.volley34.fr/?equipe={code}` (UID stable par match, heures UTC) — l'API `…/matchs` renvoyait une erreur 500 à l'essai ;
  - liste des équipes et codes : `https://api.volley34.fr/v1/equipes` (XML, club `SMDT`) ;
  - classements / résultats : `https://api.volley34.fr/v1/equipes/{code}/classements` et `/resultats` (vides avant le début de saison, format à confirmer).
  - La saisie des scores depuis l'appli n'a pas reçu de réponse : lien vers volley34 uniquement.
- **Import du fichier Excel** du club : import initial (championnat, poule, phase, journée) et import de secours. La synchro rattache les matchs volley34 aux matchs Excel (adversaire + domicile/extérieur) puis par UID.
- **volley34 fait foi pour les dates des matchs ; l'appli fait foi pour l'occupation des terrains.**
- Si la synchro échoue : planning figé sur la dernière version valide, bandeau « non mis à jour depuis le … », alerte au Bureau.
- Affichage : équipe de l'adhérent par défaut, sélecteur pour les autres ; sans équipe → tout le club. Liens sortants vers volley34 (classement, saisie de score).

## Renforts
- Un capitaine demande un renfort pour **un match à venir de son équipe** : poste (passe / avant / fond / indifférent), sexe (F / M / indifférent), message optionnel.
- La demande s'affiche sur l'**accueil de tous les adhérents** tant qu'elle est ouverte et que le match n'est pas passé.
- Notification push/email à la création, aux adhérents **hors de l'équipe**, du sexe demandé, ayant activé « renforts ».
- Chacun peut **proposer son aide** (et la retirer). Le capitaine (et le Bureau) voit les volontaires **par ordre chronologique** ; le capitaine est notifié à chaque proposition. Les autres ne voient que leur propre proposition.
- Le capitaine clôt la demande : **renfort trouvé** ou **annulée**.

## Reports
Le Bureau ne gère que la partie gymnase ; l'équipe négocie avec l'adversaire et la FSGT. Au plus ~1 demande par semaine.

| État | Déclencheur | Effet terrain |
|---|---|---|
| `requested` | Capitaine (son match) ou Bureau (tout match) choisit un créneau libre | aucun |
| `approved` | Bureau valide | pré-réservation provisoire, comptée par la compo |
| `rejected` | Bureau refuse | aucun |
| `confirmed` | la synchro voit le match à la nouvelle date | ancien créneau libéré |
| `abandoned` | capitaine/Bureau signale un refus, ou **expiration auto à J-3** de la date demandée | pré-réservation libérée |

- Reports en attente affichés sur l'**accueil des membres du Bureau** (avec les demandes de bénévolat).
- **Journal** (`reschedule_events`) : chaque action horodatée avec son auteur, visible dans l'historique (onglet Bureau).
- Un membre du Bureau peut **modifier** une validation/un refus tant que le report n'est pas `confirmed` ; le **capitaine est alors notifié**.

## Événements
- Créés par le Bureau : type (tournoi, événement de la ville, repas des adhérents, autre), titre, date, lieu, description.
- **Visibilité choisie à la création** : tous les adhérents (par défaut) ou seulement certains rôles (capitaine, bénévole, Bureau). Une personne voit l'événement si elle a **au moins un** des rôles choisis ; le Bureau voit toujours tout. Appliqué en base via RLS (événement, sondages et réponses).
- Deux sondages optionnels par événement :
  - **Présence adhérents** (proposé à tous) : je viens / je ne viens pas. Le Bureau choisit s'il demande aussi : venue d'un·e conjoint·e (oui/non), nombre d'enfants, nombre d'autres invités. Le suivi affiche adhérents, conjoint·es, enfants et total de personnes.
  - **Participation bénévole** (proposé aux bénévoles et au Bureau) : besoins par poste (ex. buvette 4), chacun indique sa dispo et son poste.
- L'événement le plus proche **visible par la personne** s'affiche sur son accueil.

## Onglet Bureau
Historique des reports · Adhérents (import Excel/CSV reconnu par email : fiches, équipes, rôles ajoutés, niveaux, comptes + email d’invitation ; demandes bénévoles) · Gymnase (ouverture de créneaux) · Annonces (message au club, à une équipe, aux bénévoles ou aux inscrits d'une séance ; push + email ; auteur affiché) · Saison (licences, cotisations, relances, exports CSV) · Liens utiles · Paramètres (équipes, échelle de niveau, horaires de notif/clôture, expiration des reports, état de la synchro) · Compo du soir.

## Tâches planifiées (pg_cron / Edge Functions)
| Tâche | Quand |
|---|---|
| Notif J-1 (demande aux non-répondants, rappel aux présents) | lun. et mer. 20h |
| Notif match J-2 aux joueurs de l'équipe | 20h, 2 jours avant chaque match |
| Clôture + compo + notif Bureau | mar. et jeu. 12h |
| Expiration des reports (J-3) | quotidien |
| Synchro volley34 | quotidien 6h |
| Purge RGPD | mensuel |
| Ping anti-mise en pause | hebdo hors saison |

Sauvegarde : `pg_dump` hebdomadaire via GitHub Action (l'offre gratuite n'a pas de restauration à un instant donné).

## Ordre de développement
1. Migration initiale (tables, rôles, RLS) + connexion lien magique + import adhérents CSV + profil.
2. Génération des séances de la saison + sondage de présence + notif J-1 (push + email en secours).
3. Import Excel du calendrier + onglet Matchs.
4. Compo automatique (fonction pure + tests) + écran Bureau.
5. Reports + journal + historique.
6. Événements et sondages, puis synchro volley34, annonces, saison, paramètres.

**V1 testable** = étapes 1–2, d'abord avec le Bureau seul.

## Conventions de travail
- Petites étapes, une fonctionnalité par branche/PR, migrations réversibles quand c'est possible.
- Logique métier (compo, nombre d'équipes, calcul des terrains libres, transitions de report) dans des fonctions pures testées.
- Ne jamais exposer `member_levels` ni la compo à un non-Bureau, même via une vue ou une fonction RPC.
- Demander avant toute décision qui contredit ce fichier ; mettre ce fichier à jour quand une règle métier change.
- Points ouverts : échelle de niveau (1–5 proposée), format des classements/résultats volley34, saisie des scores (pas de réponse), liste des adhérents à importer.
