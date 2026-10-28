import type { Metadata } from "next";
import Link from "next/link";
import { SessionCard } from "@/components/SessionCard";
import { getCurrentMember } from "@/lib/member";
import { getSessions } from "@/lib/training";

export const metadata: Metadata = { title: "Entraînements" };

const PAGE = 10;

export default async function EntrainementsPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const limit = Math.min(Number((await searchParams).n) || PAGE, 100);
  const member = (await getCurrentMember())!;
  // Séances du jour encore visibles jusqu'à la fin (22h).
  const sessions = await getSessions({
    from: new Date(Date.now() - 2 * 3600_000),
    limit,
    memberId: member.id,
  });

  return (
    <main className="page stack">
      <h1>Entraînements</h1>
      <p className="muted small">
        Mardi et jeudi, 20h–22h. Répondez pour les séances à venir ; le sondage ferme à 12h le
        jour même.
      </p>
      {sessions.length === 0 ? (
        <p className="notice">Aucune séance programmée pour l&apos;instant.</p>
      ) : (
        <ul className="list">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </ul>
      )}
      {sessions.length === limit && (
        <Link href={`/entrainements?n=${limit + PAGE}`} className="btn-secondary center">
          Voir plus de séances
        </Link>
      )}
    </main>
  );
}
