import type { SupabaseClient } from "@supabase/supabase-js";
import { PODIUM_DAYS, inSeason, podiumVisible } from "@/lib/domain/game-rewards";
import { rank } from "@/lib/domain/game-week";
import { shortName } from "@/lib/format";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Podium VUT de la saison qui vient de finir, sur l'accueil pendant 7 jours (joueurs de VUT). */
export async function SeasonPodium({ client }: { client: SupabaseClient }) {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - (PODIUM_DAYS + 1) * 86_400_000).toISOString().slice(0, 10);
  const { data: seasons } = await client.from("seasons").select("label, starts_on, ends_on").gte("ends_on", since).lt("ends_on", today);
  const season = (seasons ?? []).find((s) => podiumVisible(s.ends_on as string, today));
  if (!season) return null;

  const { data } = await client.from("game_weeks").select("owner_id, week_start, total, bonus, validated_at");
  const totals = new Map<string, { ownerId: string; total: number; bonus: number; validatedAt: string }>();
  for (const r of data ?? []) {
    if (!inSeason(r.week_start as string, { startsOn: season.starts_on as string, endsOn: season.ends_on as string })) continue;
    const e = totals.get(r.owner_id) ?? { ownerId: r.owner_id as string, total: 0, bonus: 0, validatedAt: r.validated_at as string };
    e.total += Number(r.total);
    e.bonus += Number(r.bonus);
    if ((r.validated_at as string) < e.validatedAt) e.validatedAt = r.validated_at as string;
    totals.set(r.owner_id as string, e);
  }
  const podium = rank([...totals.values()]).slice(0, 3);
  if (!podium.length) return null;
  const { data: people } = await client.from("members").select("id, first_name, last_name").in("id", podium.map((p) => p.ownerId));
  const name = new Map((people ?? []).map((p) => [p.id as string, shortName(p.first_name, p.last_name)]));

  return (
    <section className="card stack podium-card" aria-label={`Podium VUT, saison ${season.label}`}>
      <h2>🏆 Podium VUT · saison {season.label}</h2>
      <ol className="podium">
        {podium.map((p, i) => (
          <li key={p.ownerId}>
            <span aria-hidden="true">{MEDALS[i]}</span> <strong>{name.get(p.ownerId) ?? "?"}</strong>{" "}
            <span className="small">{Math.round(p.total * 10) / 10} pts</span>
          </li>
        ))}
      </ol>
      <p className="small muted">Les collections repartent de zéro pour la nouvelle saison.</p>
    </section>
  );
}
