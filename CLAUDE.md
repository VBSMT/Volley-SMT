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
- **Notifications** : Web Push (VAPID) **uniquement**, pas d'email de secours (décision du club). **Emails** (SMTP Brevo) réservés au code de connexion et à l'invitation.
- Schéma versionné : **toute évolution de la base passe par une migration** dans `supabase/migrations/`. Jamais de modif manuelle dans le dashboard.
- Secrets dans les variables d'environnement. La clé `service_role` reste côté serveur.

## Charte
Noir `#111111`, jaune `#FFE81A`, gris `#BDBDBD`, fond `#F4F4F2`. Titres Barlow Condensed 700, texte Barlow. Logo du club en en-tête. Barre d'onglets en bas.
- **Thème** clair / sombre / automatique (selon le téléphone), choisi dans le profil, mémorisé par appareil (cookie lu côté serveur : pas de flash). Couleurs en variables CSS (`--fond`, `--surface`, `--texte`…) redéfinies pour le sombre ; en-tête, barre d'onglets et jaune identiques dans les deux thèmes.
- **Thèmes de couleurs** (choix personnel dans le profil, mémorisé par appareil, cookie `palette`) : **Club** noir `#111111` / jaune `#FFE81A` (par défaut, charte du club), **Océan** `#0B2545` / `#3DDCD3`, **Bordeaux & or** `#4A0E1F` / `#F2C14E`, **Volcan** `#1E1E24` / `#FF8A2A`. Seules `--noir` (couleur foncée) et `--jaune` (accent) changent ; ne jamais écrire ces couleurs en dur dans les styles. Contrastes vérifiés en clair et en sombre.
- Victoire / défaite : paires validées (contraste ≥ 3:1 et distinctes pour les daltoniens) — clair `#0ca30c` / `#b91c1c`, sombre `#0ca30c` / `#ff5c7a` ; toujours avec libellé ou lettre.

## Rôles (cumulables)
Une personne a 1..N rôles. `captain` est rattaché à une équipe précise. Chaque adhérent a **0, 1 ou plusieurs équipes** (table `member_teams`, ex. Totally Spike + une équipe mixte) : rappels de match, sondages de match et renforts valent pour chacune.

| Rôle | Onglets |
|---|---|
| Adhérent | Accueil, Entraînements, Matchs, Stats, Événements (5) |
| Capitaine | idem + demander un report ou un **renfort**, lancer un **sondage de présence** pour **les matchs de son équipe** |
| Bénévole | idem + sondages de participation bénévole |
| Bureau | 6 onglets : + onglet **Bureau** ; tout gérer |

Les droits sont appliqués **en base via RLS**, pas seulement dans l'UI. Tester chaque rôle : `supabase/tests/rls.test.sql` (pgTAP, `supabase test db`, lancé en CI).

## Fiche adhérent
- Modifiable par l'adhérent : téléphone, contact d'urgence, droit à l'image, poste 1 et poste 2 (passe / Avant (2), à droite au filet / Avant (4), à gauche / fond ; l'ancien « avant » sans côté reste lu, et c'est le poste « avant » des demandes de renfort). Les postes sont aussi modifiables par le **capitaine** (joueurs de son équipe, fiche équipe) et le **Bureau** (tous) via la fonction `set_member_positions` (ne touche que les postes).
- Lecture seule pour lui : nom, prénom, email (sert à la connexion), équipe(s), rôles, licence FSGT + saison, cotisation réglée, sexe.
- Invisible pour lui : niveau (table séparée `member_levels`, Bureau seulement).
- Demande « Devenir bénévole » depuis le profil : confirmation, puis demande envoyée au Bureau qui valide ou refuse.
- **Notifications choisies dans le profil** (toutes activées par défaut) : entraînements (J-1), matchs de mon équipe (J-2), demandes de renfort. Désactiver un type coupe ce message. Activation du push par appareil.

## Séances d'entraînement
- Gymnase : 3 terrains. Créneaux : **tous les mardis et jeudis 20h–22h** de la saison.
- Vacances scolaires (zone C) et jours fériés : **0 terrain disponible par défaut**. Le Bureau peut rouvrir 1 à 3 terrains sur un créneau.
- Terrains libres d'une séance = terrains ouverts − matchs à domicile − pré-réservations de report validées. Une demande de report en attente (`requested`) ne prend pas de terrain mais est signalée sur la séance (« report en attente de confirmation »).

## Sondage de présence
- Ouvert en permanence pour toutes les séances à venir ; un adhérent peut répondre plusieurs séances d'avance.
- **Nominatif** : tout adhérent voit qui vient et le nombre d'inscrits.
- **Une seule notif par personne, à J-1 à 20h** (lundi pour mardi, mercredi pour jeudi ; heure réglable dans Paramètres), seulement si la séance a au moins 1 terrain libre :
  - **non-répondants** : la demande (« Entraînement demain 20h–22h — tu viens ? Réponds avant 12h demain. »), ouvre le sondage ;
  - **inscrits présents** : un rappel (« N'oublie pas : entraînement demain 20h–22h, X inscrits »).
  - Rien pour ceux qui ont répondu « je ne viens pas ». Pas d'autre relance.
  - Si une de ses équipes a un match le même jour, le message l'ajoute (« tu as match ce jour-là »), sans notif de plus.
- **Match le même jour** : la carte de la séance affiche « 🏐 Attention, tu as match ! » (équipe, adversaire, heure, lieu ; un encadré par match), même sans terrain libre ; si l'adhérent a répondu « je viens », rappel de modifier sa réponse. La réponse n'est jamais changée automatiquement.
- Envoi en **push** (Web Push) uniquement ; sans notifications activées, rien n'est reçu (l'accueil invite à les activer).
- **Clôture à 12h le jour J** (réglable dans Paramètres, de 6h à 20h ; textes de l'appli alignés sur ce réglage), puis : génération de la compo, puis notif au Bureau « compo prête, X présents, Y terrains ».
- La compo est visible **Bureau uniquement**. Les ajustements de dernière minute se font sur place ; le Bureau peut **ajouter ou retirer manuellement un présent** (Compo du soir), la compo est alors recalculée, et **déplacer des joueurs entre équipes par glisser-déposer** (ou toucher puis « Mettre ici ») : totaux et alertes recalculés, répartition conservée jusqu'à une régénération. Il peut aussi **ajouter ou supprimer une équipe** : le nombre d'équipes est alors fixé à la main (`lineups.forced_teams`) et la compo recalculée avec ce nombre (retour possible au nombre automatique).

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
  - calendrier : flux ICS par équipe `http://calendrier.volley34.fr/?equipe={code}` (UID stable par match, heures UTC ; intitulé « X reçoit Y », ou « X contre Y » pour certains matchs reportés) — l'API `…/matchs` renvoyait une erreur 500 à l'essai. Un événement citant l'équipe mais illisible est signalé au Bureau (Bureau > Calendrier + notif quand la liste change) ;
  - abonnement agenda pour les adhérents : flux servi par l'appli `/api/calendrier/{code}.ics` (public, données du calendrier public, adresse du gymnase), boutons Google Agenda / webcal depuis l'onglet Matchs ;
  - liste des équipes et codes : `https://api.volley34.fr/v1/equipes` (XML, club `SMDT`) ;
  - gymnases : `https://api.volley34.fr/v1/gymnases` (JSON : nom, adresse, GPS `lat|lon`, `NomComplet` = lieu du flux ICS), table `gyms` mise à jour à la synchro ; lien « Itinéraire » Google Maps pour les matchs à l'extérieur ;
  - classements : `https://api.volley34.fr/v1/equipes/{code}/classements` (XML : un `<Classement>` par poule avec Promus/Relegue, puis des `<ClassementCompetition>` : rang, J/G/P/forfaits, total, sets et points pour/contre, répartition des scores 3-0…0-3) ;
  - résultats match par match : `https://api.volley34.fr/v1/equipes/{code}/resultats` répond (liste vide en début de saison) pour SMDT1, SMDT6, SMDTX2, SMDTF1 mais renvoie une **erreur 500 pour SMDTX1** ; `…/matchs` renvoie une erreur 500 pour toutes les équipes (signalé à la commission). Format des résultats à observer dès les premiers scores ; en attendant, forme récente déduite des photos quotidiennes du classement.
  - La saisie des scores depuis l'appli n'a pas reçu de réponse : **lien vers la page de saisie** `https://www.volley34.fr/Pages/SaisieResultat.aspx?C=CH` (`C=CO` pour la coupe), pour les **capitaines et le Bureau** : bouton « Saisir un résultat » sur l'accueil des capitaines, page du match, liste des matchs (à venir et passés), rappel après validation d'un report.
- **Import du fichier Excel** du club : import initial (championnat, poule, phase, journée) et import de secours. La synchro rattache les matchs volley34 aux matchs Excel (adversaire + domicile/extérieur) puis par UID.
- **volley34 fait foi pour les dates des matchs ; l'appli fait foi pour l'occupation des terrains.**
- Si la synchro échoue : planning figé sur la dernière version valide, bandeau « non mis à jour depuis le … », alerte au Bureau.
- Affichage : équipe de l'adhérent par défaut, sélecteur pour les autres ; sans équipe → tout le club. Liens sortants vers volley34 (classement, saisie de score).

## Stats
- Onglet **Stats** : par défaut la (première) équipe de l'adhérent, menu pour une autre équipe ou « Tout le club » ; sans équipe → tout le club.
- Classement de la poule (équipe du club surlignée, zones montée/podium et descente selon Promus/Relegue), chiffres clés (rang, points, matchs, différences de sets et de points), victoires/défaites, **forme récente**, **répartition des scores** (3-0…0-3), **sets et points** pour/contre (moyenne par set), **points de chaque équipe de la poule**, **évolution du rang** (une photo du classement par équipe et par jour, `standings_snapshots`, prise à la synchro volley34 de 6h), avancement de la saison et prochain match.
- Vue club : toutes les équipes (rang, points, bilan).
- **Équipes du club** (`/equipes`, boutons « Équipe » / « Le club » en haut de Stats) : une carte par équipe ; la fiche montre un demi-terrain animé (joueurs placés selon leur poste 1 : passe au filet au centre, Avant (4) au filet à gauche, Avant (2) au filet à droite, fond au fond ; même poste = superposés ; sans poste = au hasard), l'effectif (capitaine ©, postes) et le prochain match. Vue `team_roster` : prénom, nom, postes, capitaine (noms affichés partout « Prénom N. », `shortName`, sauf fiches Bureau et exports) — jamais le niveau ni le sexe (le sexe n'est visible que dans VUT).
- Graphiques : méthode dataviz (série unique couleur du texte, victoire/défaite selon la charte, toujours avec libellé ou icône, infobulle au survol et au clavier, données consultables en tableau).
- Aussi : série en cours (meilleure / pire), efficacité (% sets et points gagnés), points marqués/encaissés, différence de sets de la poule (barres divergentes), attaque/défense (points par set de chaque équipe), évolution des points et de la différence de sets.
- **Félicitations éphémères** : après une victoire d'une équipe du club (détectée par la photo du classement), carte avec confettis animés en haut de l'accueil de **tous** les adhérents pendant **48 h** (score, adversaire, série, rang) ; fermable, mémorisé par appareil ; pas de notification.
- Avant le premier match de la poule (tout à zéro) : état « pas encore de match joué » et liste des équipes de la poule.

## Sondage de présence d'un match
- Le capitaine lance un sondage pour **un match à venir de son équipe** ; les joueurs de l'équipe sont notifiés (préférence « matchs ») et répondent **dispo / pas dispo** (modifiable jusqu'au match).
- Visible par les joueurs de l'équipe (noms des dispos et pas dispos), le capitaine (et le Bureau) voit aussi les non-répondants. Appliqué via RLS.
- S'il manque des joueurs, raccourci vers la demande de renfort.

## Renforts
- Un capitaine demande un renfort pour **un match à venir de son équipe** : poste (passe / avant / fond / indifférent), sexe (F / M / indifférent), message optionnel.
- La demande s'affiche sur l'**accueil de tous les adhérents** tant qu'elle est ouverte et que le match n'est pas passé.
- Notification push à la création, aux adhérents **hors de l'équipe**, du sexe demandé, ayant activé « renforts ».
- Chacun peut **proposer son aide** (et la retirer). Le capitaine (et le Bureau) voit les volontaires **par ordre chronologique** ; le capitaine est notifié à chaque proposition. Les autres ne voient que leur propre proposition.
- Le capitaine clôt la demande : **renfort trouvé** ou **annulée**.

## Reports
Le Bureau ne gère que la partie gymnase ; l'équipe négocie avec l'adversaire et la FSGT. Au plus ~1 demande par semaine. Reports **uniquement pour les matchs à domicile** (notre gymnase), **une seule demande active** (`requested`/`approved`) par match, vers un créneau à venir ayant au moins 1 terrain libre.

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

## Messagerie éphémère
- Salons : **Tout le club**, **chaque équipe** (ses joueurs uniquement ; le Bureau n'y a pas accès, sauf ses membres qui jouent dans l'équipe), **Capitaines** (capitaines + Bureau), **Bénévoles** (bénévoles + Bureau), **Bureau**. Accès via l'icône 💬 de l'en-tête (pastille des non-lus) ; pages `/chat`, `/chat/[salon]`.
- Texte seulement (1000 caractères max), noms « Prénom N. », messages **effacés après 30 jours** (purge de nuit) ; ouverture d'un salon = 70 derniers messages, bouton « Messages précédents » par paquets de 70 jusqu'à la limite de conservation. Temps réel Supabase Realtime (RLS appliquée : `can_access_room`) ; son propre message s'affiche dès l'envoi, et si le temps réel est coupé, relève des nouveaux messages toutes les 15 s (onglet visible). Un salon s'ouvre tout en bas, sur les derniers messages.
- Chacun supprime ses messages, le Bureau tous ; « Signaler » notifie le Bureau.
- Notifications **désactivées par défaut** : par salon (cloche 🔔 dans le salon, `chat_room_prefs.notify`) et « quand on me cite » (@Prénom N., `members.notify_mentions`, dans le profil).
- Exception à la convention de confirmation : l'envoi d'un message n'en demande pas (suppression et signalement, si).

## VUT — Volley Ultimate Team (jeu de cartes style FUT)
**Jeu réservé au Bureau pour l'instant** (phase de test : page `/jeu` et vue `game_cards` limitées au Bureau ; l'ajout de photo dans le profil est ouvert à tous les adhérents pour préparer leurs cartes). L'icône « VUT » de l'en-tête est visible par **tous les adhérents** : pour eux, elle ouvre les **règles** (`/jeu/regles`, ouvertes à tous, avec « 🚧 Bientôt disponible » ; prénoms des Légendes masqués hors Bureau). Facultatif. Aucune notification, sauf un booster gagné.
- **Carte** = un joueur dans une équipe du club (`member_teams`), à son **poste 1** (l'ancien « avant » compte en Avant (4)) ; sans poste, pas de carte ; deux équipes = deux cartes. Vue `game_cards`.
- **Design** : haut à la couleur du poste (passe violet, Avant (4) rouge, Avant (2) vert, fond bleu), note, poste, pastille **M/F** en haut à droite, photo ou silhouette, « Prénom N. » ; sous la ligne, bandeau **or ≥ 80 / argent 65–79 / bronze** avec le nom de l'équipe.
- **Raretés** (vue `game_cards`, colonne `kind`) : **commune** (poste 1) ; **rare** (poste 2, si configuré : liseré irisé, reflet, « ★ 2ᵉ POSTE ») ; **ultra rare Capitaine** (une carte par capitaine, sa 1re équipe ; « full art » noir et or, logo C en haut, fanion CAPITAINE, sans poste) ; **Légende** (membres du Bureau ayant un bonus dans `game_legends` ; full art blanc et or, rayons, couronne, fanion LÉGENDE, note 99 fixe, « Prénom N. » puis BUREAU ; la carte du développeur a le bandeau « LE DEV », des lignes de code et des rayons verts). Photo (avec droit à l'image) aussi sur Capitaine et Légende : **Légende** = photo dorée (sépia) sur toute la carte, fondue vers le bas ; **Capitaine** = portrait détouré (halo) en couleurs ; sans photo, grande silhouette.
- **Tirage d'un booster gagné**, pour chaque carte : 0,5 % Légende, sinon 3 % Capitaine, sinon un joueur au hasard, en version rare à 10 % s'il a un poste 2. Booster de départ : communes seulement.
- **Case Bonus** (à gauche du fond, symétrique du remplaçant) : un Capitaine ou une Légende, uniquement là ; **verrouillée dès le début du premier match d'un de ses titulaires** (sinon on choisirait la Légende une fois les résultats connus) ; ils ne comptent pas dans la limite de 2 joueurs par équipe ; un capitaine en case Bonus ne peut pas aussi être aligné comme joueur. **Capitaine** : +5 % du total, +10 % si son équipe gagne son match. **Légendes** (attribuées par migration, liste du club) : Jérôme +2 par titulaire gagnant ; Xavier ×5 bonus du fond ; Owen ×4 bonus du passeur ; Ratsiam (Ratsou) ×2,5 bonus des avants ; Lydie remplaçant à 100 % (au lieu de 50 %, jamais plus) ; Guylaine +8 si 5 filles (4 titulaires + remplaçant) ; Benjamin +30 % du total des titulaires si les 4 gagnent.
- **Sexe visible dans le jeu** (décision du club : règle « au moins une fille ») ; jamais le niveau.
- **Note de forme** (40–99) = moyenne des points du barème des 5 derniers matchs de l'équipe (moins s'il y en a moins), `40 + moyenne × 5,9` ; **60** avant le premier match ; recalculée à la synchro de 6h (`game_team_form`, record de la saison `best_rating`) ; les cartes déjà obtenues suivent.
- **Barème** : 3-0 → 10, 3-1 → 8, 3-2 → 6, 2-3 → 3, 1-3 → 1, 0-3 → 0 (forfait gagné = 3-0). Bonus de poste : passe +1 par set gagné ; avant +1 par tranche de 10 points d'écart, **plafonné à +4** (sans les points : +2 pour une victoire 3-0 ou 3-1) ; fond **+1 par set à moins de 20 points encaissés** (tant que volley34 ne publie pas le détail par set : +1 par set joué si la moyenne encaissée est sous 20 ; sans les points : +2 pour une défaite en 5 sets). Maximum d'une compo parfaite (un match par équipe, hors Capitaine et Légende) : 13 + 14 + 14 + 13 + 7 = 61 points.
- **Équipe de la journée** (lundi–dimanche) : 4 titulaires (passe, Avant (2), Avant (4), fond) + 1 remplaçant de n'importe quel poste ; ≥ 1 fille parmi les titulaires ; ≤ 2 joueurs d'une même équipe ; chaque carte verrouillée au début du match de son équipe ; avertissement si son équipe ne joue pas. Remplaçant à 50 %, ou 100 % s'il remplace un titulaire qui n'a pas joué (sinon 0).
- **Boosters** : départ = 6 cartes (≥ 1 par poste, ≥ 1 fille, pas de doublon, ≤ 2 par équipe), ouvert par une animation (paquet qui tremble, éclair, cartes retournées) ; boosters gagnés de 2 ou 3 cartes (50 %), totalement aléatoires (doublons possibles) : valider sa journée, top 3 de la journée, **réponse au sondage de 3 entraînements** (booster gagné à 22h après le 3e entraînement passé, puis le compteur repart à zéro), présence à un événement. Doublon = 1 éclat ; 5 éclats = une carte au choix. Pas d'achat ni d'échange. Tirage côté serveur (`lib/domain/game.ts`).
- **Classements** de la journée et de la saison (égalité : bonus de poste, puis validation la plus tôt) ; podium affiché 7 jours sur l'accueil en fin de saison ; collections remises à zéro chaque saison.
- **Photo** : ajoutée par l'adhérent dans son profil, **recadrée par lui** (glisser pour placer le visage dans le rond, zoom au curseur ou en pinçant, aperçu de sa carte en direct ; `lib/domain/photo-crop.ts`), puis carré 320 px ( WebP ou JPEG sur Safari, compressé dans le navigateur ; format vérifié au contenu), **seulement avec le droit à l'image** ; le retirer efface la photo (déclencheur + fichier) ; bucket privé `photos`, servie par `/api/photo/[id]` aux adhérents connectés seulement, jamais publique ni exportée ; le Bureau peut la retirer ; supprimée avec la fiche, et purge de nuit des fichiers orphelins.
- **Onglets** Équipe · Boosters (pastille du nombre à ouvrir, aussi sur « VUT » dans l'en-tête ; les boosters ne bloquent plus la page) · Collection · Classement.
- **Écran « Équipe »** tenant sur un écran : terrain compact (**sélecteur de journée** ‹ › : une journée = une semaine lundi–dimanche ayant au moins un match du club au calendrier, numérotées dans l'ordre en sautant les semaines sans match ; titre « Compo Journée N — du jj/mm au jj/mm » ; journées passées en lecture seule (points, « ✓ terminée » ou « ⏳ provisoire »), journée en cours et jusqu'à 4 semaines d'avance modifiables, bouton « ↺ Reprendre la compo précédente » ; Avant (4), passe, Avant (2) au filet, fond, case « Remplaçant » petite dans le coin (libellé au-dessus), bouton Valider sur le terrain), pastilles d'alerte au-dessus ; main en **roue** (glisser pour tourner, toucher la carte du centre pour la poser à son poste, glisser vers le haut pour déposer), filtres par poste, toucher une place vide filtre la main ; toucher une carte posée la remet en main. Animations légères (CSS `transform`/`opacity`, coupées si « réduire les animations ») : carte qui atterrit, éclat doré, places compatibles qui pulsent, titulaires allumés et score qui défile à la validation. Validation avec confirmation puis « Annuler ».
- **Collection** en **album** : compteur « X / total », barre de progression, pastille « ✦ N éclats » (mode échange) ; « Ranger par » Équipe · Poste · Rareté, rubriques avec compteur « n / total » (✓ si complète) et titre collé en haut au défilement ; 4 petites cartes par ligne, triées par note, badge « ×2 » ; **cartes manquantes en gris** (« ? » + nom), case « Manquantes » ; toucher une carte l'ouvre en grand dans le carrousel 3D de sa rubrique (glisser, toucher pour retourner : équipe, note, record, exemplaires, bonus), ✕ pour revenir.
- **Points** calculés chaque jour à 7h, après la synchro de 6h. **Résultats datés** (`game_team_results`) : à chaque photo du classement, les nouveaux résultats sont rattachés aux matchs joués de l'équipe encore sans résultat (le plus ancien d'abord), donc un score publié en retard compte dans la **semaine du match**. Une semaine reste **provisoire** tant qu'un match joué n'a pas de résultat (« ⏳ En attente du résultat : … »), et devient **définitive** quand elle est complète, ou 14 jours après sa fin (match manquant = non joué) ; les semaines provisoires sont recalculées chaque matin ; le booster du top 3 est donné quand la semaine devient définitive (`game_weeks.final`, `pending`).
- **API des résultats volley34** : surveillée à chaque synchro ; au premier résultat publié, une alerte unique au Bureau (`sync_flags`). Elle deviendra alors la source principale (dates, points par set), le classement restant en secours.
- **Maître du jeu** : un seul compte, celui dont l'email est dans la variable Vercel `VUT_MASTER_EMAIL` (`lib/game-master.ts`, vérifié côté serveur ; sans variable, personne). Lui seul voit les panneaux Cadeaux et Outils de test.
- **Cadeaux** (`gift-actions.ts`, panneau « 🎁 Cadeaux » en bas de `/jeu`) : à **n'importe quel adhérent**, une équipe ou tous les adhérents (hors Bureau : le cadeau attend l'ouverture du jeu, push seulement aux joueurs actuels) ; 1 à 5 boosters au hasard, ou une **carte précise** de n'importe quelle rareté (Capitaine et Légende compris), livrée dans un booster scellé (`game_boosters.gift_cards`) ; message facultatif (140 caractères, affiché à l'ouverture et dans le push « 🎁 Cadeau VUT ») ; confirmation, « Annuler » tant que ce n'est pas ouvert, historique des 20 derniers. Raison `gift:<uuid>`. Une carte obtenue d'abord par cadeau porte la mention « 🎁 Cadeau » au dos dans l'album (`game_collection.gifted`). Les cadeaux restent après l'ouverture du jeu à tous.
- **Outils de test (maître du jeu)** sur `/jeu`, masqués et refusés côté serveur si `VUT_TEST_TOOLS=off`, pour tous les joueurs du jeu : remise à zéro complète, +1 booster à chacun, simuler un résultat d'équipe (`game_test_results`, remplace le vrai pour la semaine), effacer les simulations (notes à 60), recalculer les points. À retirer ou restreindre à l'ouverture du jeu à tous.
- **Règles du jeu** : page `/jeu/regles` (lien « 📖 Règles du jeu » en bas de VUT) : principe, cartes d'exemple pour chaque rareté et chaque teinte de note, équipe et verrouillage, barème et bonus de poste (tableaux, exemple chiffré), case Bonus et pouvoirs des Légendes, boosters et éclats, classements et saison. À tenir à jour à chaque changement de règle.
- Ouvrir un booster ne demande pas de confirmation (comme l'envoi d'un message).
- **Boosters gagnés automatiquement** (`lib/game-rewards.ts`, une seule fois par raison : index unique `owner_id, reason`, push « 🎁 Nouveau booster VUT ») : première validation de la semaine (`week:…`, tout de suite pour la journée en cours ; pour une journée validée à l'avance, à 22h pendant cette journée ; une validation anticipée compte au départage comme faite le lundi 0h) ; top 3 de la semaine, quand ses points deviennent définitifs (`top3:…`) ; tous les 3 entraînements passés avec une réponse au sondage, à 22h (`training:N`) ; présence à un événement passé, à 22h (`event:…`).
- **Booster du jour** (Bureau pour l'instant) : carte en haut de l'onglet Boosters, 1 booster par jour (`daily:AAAA-MM-JJ`, heure de Paris) récupéré d'un toucher ; au 7ᵉ jour de suite un booster bonus (`streak:…`), puis la série repart ; un jour manqué remet la série à zéro ; compté dans la pastille VUT tant qu'il n'est pas récupéré. Purge de nuit : boosters ouverts depuis plus de 30 jours supprimés (`daily`, `streak`, `test`) ou vidés de leurs cartes (les autres, pour garder l'unicité des raisons).
- **Éclats** (`game_wallet`, modifiés en une seule opération en base : `game_add_shards`, `game_add_cards`, réservées au serveur) : 1 par carte déjà possédée à l'ouverture (ou sortie deux fois dans le même booster) ; **5 éclats une commune, 20 une rare** (`shardPrice`), pas Capitaine ni Légende. Échange **dans l'album** : la pastille « ✦ N éclats » active le mode échange (cartes manquantes seulement, avec leur prix ; celles qu'on peut s'offrir pulsent, les autres grisées) ; toucher une carte ouvre une confirmation avec son aperçu et le solde restant.
- **Fin de saison** : classement « Saison » limité aux semaines de la saison en cours ; podium VUT sur l'accueil des joueurs pendant 7 jours après la fin de saison ; le jour du début de la saison suivante (3h), collections, boosters, équipes et éclats repartent de zéro (l'historique des points reste).
- Avancement : PR 1 à 3 faites (cartes, note, boosters, collection, photos, équipe de la semaine, points, classements, raretés, case Bonus, récompenses, éclats, saison). Reste : ouverture à tous les adhérents (lever les restrictions Bureau) et retrait des outils de test.

## Onglet Bureau
Historique des reports · Adhérents (liste filtrable par équipe, pastille d'installation : Sans compte / Jamais connecté / Connecté / Configuré = guide terminé ou passé, avec le décompte, bouton « Relancer par email » des non connectés (compte créé si besoin) ; fiche modifiable : identité, **email tant que l'adhérent ne s'est jamais connecté** (fiche et compte de connexion corrigés ensemble ; verrouillé après une première connexion), licence, cotisation, équipes, capitanats, rôles, niveau ; import Excel/CSV reconnu par email : fiches, équipes et rôles ajoutés, niveaux, comptes + email d’invitation facultatif ; validation des demandes bénévoles ; suppression définitive d'une fiche avec confirmation) · Gymnase (ouverture de créneaux) · Annonces (message au club, à une équipe, aux bénévoles ou aux inscrits d'une séance ; push ; auteur affiché) · Saison (licences, cotisations, relances, exports CSV) · Liens utiles · Paramètres (équipes, échelle de niveau, horaires de notif/clôture, expiration des reports, état de la synchro) · Compo du soir.

## Tâches planifiées (pg_cron / Edge Functions)
| Tâche | Quand |
|---|---|
| Notif J-1 (demande aux non-répondants, rappel aux présents) | lun. et mer. 20h |
| Notif match J-2 aux joueurs de l'équipe | 20h, 2 jours avant chaque match |
| Clôture + compo + notif Bureau | mar. et jeu. 12h |
| Expiration des reports (J-3) | quotidien |
| Synchro volley34 | quotidien 6h |
| Purge RGPD (niveaux des adhésions terminées, fiches + comptes 2 ans après, photos orphelines, vieux boosters ouverts) | quotidien 3h (idempotent) |
| Ping anti-mise en pause | couvert par le tick horaire (requêtes Supabase chaque heure) |

Guide de première connexion (`components/GuidedTour.tsx`) : zones en surbrillance (`data-tour`), 5 étapes (installer, notifications, profil — postes, contact, droit à l'image, « Enregistrer », vérification, préférences —, « Informe si tu viens, ou pas », fin) ; avancement en base (`members.onboarding_step`, `onboarding_done_at`), reprise à l'étape suivante si interrompu, « Passer le guide » définitif, « Revoir le guide » dans le profil.

Hors ligne : le service worker garde la dernière version des pages adhérent consultées (jamais `/bureau`), vidée à la déconnexion. Aide publique : `/aide`.

Sauvegarde : `supabase db dump` hebdomadaire via GitHub Action (`backup.yml`), chiffré GPG (`BACKUP_PASSPHRASE`), artefact conservé 30 jours (l'offre gratuite n'a pas de restauration à un instant donné).

## Ordre de développement
1. Migration initiale (tables, rôles, RLS) + connexion lien magique + import adhérents CSV + profil.
2. Génération des séances de la saison + sondage de présence + notif J-1 (push).
3. Import Excel du calendrier + onglet Matchs.
4. Compo automatique (fonction pure + tests) + écran Bureau.
5. Reports + journal + historique.
6. Événements et sondages, puis synchro volley34, annonces, saison, paramètres.

**V1 testable** = étapes 1–2, d'abord avec le Bureau seul.

## Conventions de travail
- **Fusion automatique** (demande de Benjamin) : une fois le build, les tests et la vérification passés, Claude ouvre la PR et la fusionne lui-même dans `main` (le déploiement Vercel et les migrations suivent).
- Toute action qui notifie ou modifie (sondage, report, renfort, présence…) passe par une **confirmation**, puis un message avec **Annuler** (`components/Feedback.tsx`).
- Petites étapes, une fonctionnalité par branche/PR, migrations réversibles quand c'est possible.
- Logique métier (compo, nombre d'équipes, calcul des terrains libres, transitions de report) dans des fonctions pures testées.
- Ne jamais exposer `member_levels` ni la compo à un non-Bureau, même via une vue ou une fonction RPC.
- Demander avant toute décision qui contredit ce fichier ; mettre ce fichier à jour quand une règle métier change.
- Points ouverts : échelle de niveau (1–5 proposée), API volley34 `matchs` (500 pour tous) et `resultats` (500 pour SMDTX1), format des résultats à observer, saisie des scores (pas de réponse).
