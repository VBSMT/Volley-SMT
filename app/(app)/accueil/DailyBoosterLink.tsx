import Link from "next/link";

/** Petit booster à côté du prénom tant que le booster du jour n'est pas récupéré (Bureau pour l'instant). */
export function DailyBoosterLink({ bonus }: { bonus: boolean }) {
  return (
    <Link href="/jeu?vue=boosters" className="home-daily" aria-label={bonus ? "Récupérer tes 2 boosters VUT du jour" : "Récupérer ton booster VUT du jour"}>
      <span className="home-daily-pack" aria-hidden="true">VUT</span>
      {bonus && <span className="home-daily-bonus" aria-hidden="true">×2</span>}
    </Link>
  );
}
