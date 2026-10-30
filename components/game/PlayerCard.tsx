import { type GameCard, GAME_POSITION_LABELS, tierOf } from "@/lib/domain/game";
import { shortName } from "@/lib/format";

/**
 * Carte d'un joueur : haut à la couleur du poste (note, poste, M/F, photo ou silhouette, nom),
 * bandeau du bas or / argent / bronze selon la forme de l'équipe, avec le nom de l'équipe.
 */
export function PlayerCard({ card, copies }: { card: GameCard; copies?: number }) {
  const name = shortName(card.firstName, card.lastName);
  const label = `${name}, ${GAME_POSITION_LABELS[card.position]}, ${card.teamName}, note ${card.rating}, ${card.sex === "F" ? "fille" : "garçon"}`;
  return (
    <div className={`pcard pcard-${tierOf(card.rating)} pcard-${card.position}`} role="img" aria-label={label}>
      <div className="pcard-rate">{card.rating}</div>
      <div className="pcard-pos">{GAME_POSITION_LABELS[card.position].toUpperCase()}</div>
      <div className="pcard-sex" aria-hidden="true">{card.sex}</div>
      {card.photoVersion ? (
        // Photo servie par l'appli aux adhérents connectés (droit à l'image vérifié côté serveur).
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pcard-photo" src={`/api/photo/${card.memberId}?v=${card.photoVersion}`} alt="" loading="lazy" />
      ) : (
        <svg className="pcard-sil" viewBox="0 0 100 120" aria-hidden="true">
          <circle cx="50" cy="34" r="15" />
          <path d="M22 112 C24 80 36 62 50 62 C64 62 76 80 78 112" />
        </svg>
      )}
      <div className="pcard-name">{name}</div>
      <div className="pcard-team">{card.teamName}</div>
      {copies !== undefined && copies > 1 && <div className="pcard-copies">×{copies}</div>}
    </div>
  );
}
