import type { SupabaseClient } from "@supabase/supabase-js";
import { inSeason } from "@/lib/domain/game-rewards";
import { rank } from "@/lib/domain/game-week";
import { shortName } from "@/lib/format";

type Row = { owner_id: string; week_start: string; total: number; bonus: number; validated_at: string };

/** Classements VUT : semaine en cours (points provisoires) et saison (somme des semaines). */
export async function Ranking({ client, week, memberId, season: current }: { client: SupabaseClient; week: string; memberId: string; season: { startsOn: string; endsOn: string } | null }) {
  const { data } = await client.from("game_weeks").select("owner_id, week_start, total, bonus, validated_at");
  // Saison en cours seulement (l'historique des saisons passées reste en base).
  const rows = ((data ?? []) as Row[]).filter((r) => !current || inSeason(r.week_start, current));
  const ids = [...new Set(rows.map((r) => r.owner_id))];
  const { data: people } = ids.length ? await client.from("members").select("id, first_name, last_name").in("id", ids) : { data: [] };
  const name = new Map((people ?? []).map((p) => [p.id as string, shortName(p.first_name, p.last_name)]));

  const weekly = rank(rows.filter((r) => r.week_start === week).map((r) => ({ ownerId: r.owner_id, total: Number(r.total), bonus: Number(r.bonus), validatedAt: r.validated_at })));
  const season = new Map<string, { ownerId: string; total: number; bonus: number; validatedAt: string }>();
  for (const r of rows) {
    const e = season.get(r.owner_id) ?? { ownerId: r.owner_id, total: 0, bonus: 0, validatedAt: r.validated_at };
    e.total += Number(r.total);
    e.bonus += Number(r.bonus);
    if (r.validated_at < e.validatedAt) e.validatedAt = r.validated_at;
    season.set(r.owner_id, e);
  }

  const table = (title: string, entries: ReturnType<typeof rank<{ ownerId: string; total: number; bonus: number; validatedAt: string }>>) => (
    <section className="card stack">
      <h2>{title}</h2>
      {entries.length ? (
        <table className="ranking">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Joueur</th>
              <th scope="col">Points</th>
              <th scope="col">Bonus</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.ownerId} className={e.ownerId === memberId ? "is-mine" : undefined}>
                <td>{e.rank}</td>
                <td>{name.get(e.ownerId) ?? "?"}</td>
                <td>{Math.round(e.total * 10) / 10}</td>
                <td>{Math.round(e.bonus * 10) / 10}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="small">Personne n&apos;a encore validé d&apos;équipe.</p>
      )}
    </section>
  );

  return (
    <>
      {table("Cette semaine (provisoire)", weekly)}
      {table("Saison", rank([...season.values()]))}
      <p className="small muted">Points calculés chaque matin à 7h, après la mise à jour des classements volley34 ; définitifs le lundi.</p>
    </>
  );
}
