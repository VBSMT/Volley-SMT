import { type GameCard, GAME_POSITION_LABELS, tierOf } from "@/lib/domain/game";
import { shortName } from "@/lib/format";

const KIND_LABELS = { common: "", rare: "rare, 2ᵉ poste", captain: "ultra rare, Capitaine", legend: "Légende" };

/**
 * Carte VUT d'un joueur.
 * - commune / rare : haut à la couleur du poste (note, poste, M/F, photo ou silhouette, nom), bandeau
 *   or / argent / bronze selon la forme de l'équipe ; la rare (2ᵉ poste) a un liseré irisé et l'étiquette « ★ 2ᵉ POSTE » ;
 * - Capitaine (ultra rare) et Légende (Bureau) : « full art », grande silhouette (jamais de photo),
 *   fanion à la place du poste, logo C ou couronne en haut ; la carte du développeur a sa touche « LE DEV ».
 */
export function PlayerCard({ card, copies }: { card: GameCard; copies?: number }) {
  const name = shortName(card.firstName, card.lastName);
  const kind = card.kind ?? "common";
  const full = kind === "captain" || kind === "legend";
  const label = `${name}, ${full ? KIND_LABELS[kind] : GAME_POSITION_LABELS[card.position]}${kind === "rare" ? `, ${KIND_LABELS.rare}` : ""}, ${card.teamName}, note ${card.rating}, ${card.sex === "F" ? "fille" : "garçon"}`;

  if (full) {
    return (
      <div className={`pcard pcard-full pcard-${kind}${card.isDev ? " pcard-dev" : ""}`} role="img" aria-label={label}>
        {kind === "legend" && <div className="pcard-rays" />}
        <div className="pcard-foil" />
        <div className="pcard-top-badge">{kind === "captain" ? "C" : "♛"}</div>
        <div className="pcard-rate">{card.rating}</div>
        <div className="pcard-fanion">{kind === "captain" ? "CAPITAINE" : "LÉGENDE"}</div>
        <div className="pcard-sex" aria-hidden="true">{card.sex}</div>
        <svg className="pcard-bigsil" viewBox="0 0 100 120" aria-hidden="true">
          <circle cx="50" cy="30" r="17" />
          <path d="M8 125 C10 80 30 56 50 56 C70 56 90 80 92 125" />
        </svg>
        {card.isDev && (
          <>
            <div className="pcard-code" aria-hidden="true">
              const legende = true;
              <br />
              if (smash) win();
              <br />
              {"// v1.0 · le dev"}
            </div>
            <div className="pcard-devtag">LE DEV</div>
          </>
        )}
        {kind === "legend" && <div className="pcard-sparkles" />}
        <div className="pcard-name">{name}</div>
        <div className="pcard-fullteam">{kind === "legend" ? "BUREAU" : card.teamName}</div>
        {copies !== undefined && copies > 1 && <div className="pcard-copies">×{copies}</div>}
      </div>
    );
  }

  return (
    <div className={`pcard pcard-${tierOf(card.rating)} pcard-${card.position}${kind === "rare" ? " pcard-rare" : ""}`} role="img" aria-label={label}>
      <div className="pcard-rate">{card.rating}</div>
      <div className="pcard-pos">{GAME_POSITION_LABELS[card.position].toUpperCase()}</div>
      {kind === "rare" && <div className="pcard-raretag">★ 2ᵉ POSTE</div>}
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
