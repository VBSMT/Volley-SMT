import Link from "next/link";

/** Deux boutons d'accès aux fiches équipes (terrain animé) : mon équipe et tout le club. */
export function TeamNav({ myTeamId }: { myTeamId: string | null }) {
  return (
    <nav className="team-nav" aria-label="Équipes">
      {myTeamId && (
        <Link href={`/equipes/${myTeamId}`} className="team-nav-btn">
          <span aria-hidden="true">🏐</span> Mon équipe
        </Link>
      )}
      <Link href="/equipes" className="team-nav-btn">
        <span aria-hidden="true">👥</span> Le club
      </Link>
    </nav>
  );
}
