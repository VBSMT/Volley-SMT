import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerCard } from "@/components/game/PlayerCard";
import { type GameCard, CAPTAIN_RATE, LEGEND_BONUS_LABELS, LEGEND_RATE, RARE_RATE, STARTER_SIZE } from "@/lib/domain/game";
import { SHARDS_PER_CARD, TRAININGS_PER_BOOSTER } from "@/lib/domain/game-rewards";
import { getCurrentMember, hasRole } from "@/lib/member";

export const metadata: Metadata = { title: "VUT · Règles du jeu" };

const pct = (rate: number) => `${(rate * 100).toLocaleString("fr-FR")} %`;

const base: GameCard = {
  memberId: "exemple",
  teamId: "t",
  teamName: "Les Bras Cassés",
  firstName: "Camille",
  lastName: "Martin",
  sex: "F",
  position: "setter",
  rating: 72,
  bestRating: 80,
  photoVersion: null,
};
const EXAMPLES: { card: GameCard; title: string; text: string }[] = [
  { card: { ...base, rating: 84 }, title: "Commune", text: "Le joueur à son poste 1. Bandeau or (note ≥ 80)." },
  { card: { ...base, position: "back", kind: "rare", rating: 70 }, title: `Rare · ${pct(RARE_RATE)}`, text: "Le même joueur à son poste 2. Liseré irisé." },
  { card: { ...base, firstName: "Alex", sex: "M", kind: "captain", rating: 66 }, title: `Capitaine · ${pct(CAPTAIN_RATE)}`, text: "Ultra rare. Uniquement dans la case Bonus." },
  { card: { ...base, firstName: "Sam", sex: "M", teamName: "Bureau", kind: "legend", rating: 99 }, title: `Légende · ${pct(LEGEND_RATE)}`, text: "Un membre du Bureau. Case Bonus, avec son pouvoir." },
];
const TIERS: GameCard[] = [
  { ...base, rating: 86, firstName: "Or" },
  { ...base, rating: 72, firstName: "Argent", position: "front_left" },
  { ...base, rating: 55, firstName: "Bronze", position: "front_right" },
];
const LEGENDS: [string, keyof typeof LEGEND_BONUS_LABELS][] = [
  ["Jérôme", "per_win"],
  ["Xavier", "back_x5"],
  ["Owen", "setter_x4"],
  ["Ratsiam", "front_x2_5"],
  ["Lydie", "bench_x2"],
  ["Guylaine", "five_girls"],
  ["Benjamin", "all_win_30"],
];

/** Règles de VUT : principe, raretés (avec exemples), équipe, points, bonus, boosters, classement. */
export default async function ReglesPage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  return (
    <main className="page stack rules">
      <div className="stats-head">
        <h1>Règles de VUT</h1>
        <Link href="/jeu" className="small">← Retour au jeu</Link>
      </div>

      <section className="card stack">
        <h2>🏐 Le principe</h2>
        <p>Collectionne les cartes des joueurs du club, compose ton équipe chaque journée, et marque des points avec les <strong>vrais résultats</strong> des équipes du club sur volley34.</p>
        <ol className="rules-steps">
          <li>Ouvre ton premier booster ({STARTER_SIZE} cartes).</li>
          <li>Pose 4 titulaires, un remplaçant et un bonus sur le terrain.</li>
          <li>Les équipes jouent leurs matchs : tes cartes marquent des points.</li>
          <li>Gagne des boosters, complète ta collection, grimpe au classement.</li>
        </ol>
      </section>

      <section className="card stack">
        <h2>🃏 Les cartes et leur rareté</h2>
        <ul className="rules-cards" role="list">
          {EXAMPLES.map((e) => (
            <li key={e.title}>
              <div className="pcard-slot">
                <PlayerCard card={e.card} />
              </div>
              <strong>{e.title}</strong>
              <span className="small">{e.text}</span>
            </li>
          ))}
        </ul>
        <p className="small">
          Les pourcentages sont les chances, pour chaque carte d&apos;un booster gagné. Le booster de départ ne contient que des communes.
        </p>
        <h3>La note et la couleur du bandeau</h3>
        <ul className="rules-cards rules-tiers" role="list">
          {TIERS.map((c) => (
            <li key={c.firstName}>
              <div className="pcard-slot">
                <PlayerCard card={c} />
              </div>
            </li>
          ))}
        </ul>
        <p>
          La note (40 à 99) est la <strong>forme de l&apos;équipe</strong> sur ses 5 derniers matchs, recalculée chaque matin : <strong>or</strong> à partir de 80,{" "}
          <strong>argent</strong> de 65 à 79, <strong>bronze</strong> en dessous. 60 avant le premier match. La couleur du haut indique le poste : passe violet, Avant (4) rouge,
          Avant (2) vert, fond bleu.
        </p>
      </section>

      <section className="card stack">
        <h2>📋 Ton équipe de la journée</h2>
        <ul>
          <li>Une <strong>journée</strong> = une semaine (lundi → dimanche) où le club a au moins un match.</li>
          <li><strong>4 titulaires</strong> à leur poste : passe, Avant (4), Avant (2), fond.</li>
          <li><strong>1 remplaçant</strong> de n&apos;importe quel poste (facultatif).</li>
          <li><strong>1 case Bonus</strong> : un Capitaine ou une Légende (facultatif).</li>
          <li>Au moins <strong>une fille</strong> parmi les titulaires, et au plus <strong>2 joueurs</strong> d&apos;une même équipe.</li>
        </ul>
        <div className="rules-box">
          <strong>🔒 Verrouillage</strong>
          <p>Une carte se verrouille au début du match de son équipe. La case Bonus se verrouille au premier match d&apos;un de tes titulaires. Tu peux préparer jusqu&apos;à 4 journées à l&apos;avance.</p>
        </div>
      </section>

      <section className="card stack">
        <h2>🔢 Les points</h2>
        <table className="ranking">
          <caption className="small">Points de base selon le score de l&apos;équipe</caption>
          <thead>
            <tr><th scope="col">Score</th><th scope="col">3-0</th><th scope="col">3-1</th><th scope="col">3-2</th><th scope="col">2-3</th><th scope="col">1-3</th><th scope="col">0-3</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Points</th><td>10</td><td>8</td><td>6</td><td>3</td><td>1</td><td>0</td></tr>
          </tbody>
        </table>
        <table className="ranking">
          <caption className="small">Bonus de poste</caption>
          <tbody>
            <tr><th scope="row">Passe</th><td>+1 par set gagné</td></tr>
            <tr><th scope="row">Avants</th><td>+1 par tranche de 10 points d&apos;écart (max +4)</td></tr>
            <tr><th scope="row">Fond</th><td>+1 par set à moins de 20 points encaissés</td></tr>
          </tbody>
        </table>
        <ul>
          <li>Le <strong>remplaçant</strong> compte à 50 %, ou à 100 % s&apos;il remplace un titulaire dont l&apos;équipe n&apos;a pas joué.</li>
          <li>Points recalculés chaque matin. Un résultat publié en retard compte dans la journée du match ; la journée devient définitive quand tout est connu (au plus tard 14 jours après).</li>
        </ul>
        <div className="rules-box">
          <strong>Exemple</strong>
          <p>Ton passeur gagne 3-1 : 8 + 3 sets gagnés = <strong>11 points</strong>. Ton avant gagne 3-0 avec 30 points d&apos;écart : 10 + 3 = <strong>13 points</strong>.</p>
          <p className="small">Maximum d&apos;une compo parfaite (hors bonus) : 61 points.</p>
        </div>
      </section>

      <section className="card stack">
        <h2>⭐ La case Bonus</h2>
        <p><strong>Capitaine</strong> : +5 % sur ton total, <strong>+10 %</strong> si son équipe gagne son match.</p>
        <table className="ranking">
          <caption className="small">Les Légendes du Bureau et leur pouvoir</caption>
          <tbody>
            {LEGENDS.map(([name, bonus]) => (
              <tr key={name}>
                <th scope="row">♛ {name}</th>
                <td>{LEGEND_BONUS_LABELS[bonus]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <h2>🎁 Boosters et éclats</h2>
        <table className="ranking">
          <caption className="small">Comment gagner un booster (2 ou 3 cartes)</caption>
          <tbody>
            <tr><th scope="row">Valider ton équipe</th><td>1 par journée</td></tr>
            <tr><th scope="row">Top 3 de la journée</th><td>1 de plus</td></tr>
            <tr><th scope="row">Sondage d&apos;entraînement</th><td>1 tous les {TRAININGS_PER_BOOSTER} entraînements répondus</td></tr>
            <tr><th scope="row">Événement du club</th><td>1 si tu es venu·e</td></tr>
          </tbody>
        </table>
        <p>
          <strong>✦ Éclats</strong> : chaque carte en double te donne 1 éclat. Avec {SHARDS_PER_CARD} éclats, tu choisis une carte commune ou rare dans l&apos;onglet Collection.
        </p>
      </section>

      <section className="card stack">
        <h2>🏆 Classements et saison</h2>
        <ul>
          <li>Classement de la journée et de la saison. À égalité : le plus de bonus, puis l&apos;équipe validée le plus tôt.</li>
          <li>En fin de saison, le podium s&apos;affiche 7 jours sur l&apos;accueil, puis les collections repartent de zéro.</li>
        </ul>
      </section>

      <Link href="/jeu" className="btn-primary rules-play">Jouer</Link>
    </main>
  );
}
