import type { Metadata } from "next";
import Link from "next/link";
import { RankChart } from "@/components/stats/RankChart";
import { AttackDefense } from "@/components/stats/AttackDefense";
import { Efficiency, PointsTotals, SetDiffPool, StreakCard } from "@/components/stats/MoreStats";
import { HeroStats, PoolComparison, ScoreBreakdown, SeasonCard, StandingsTable, WinLoss } from "@/components/stats/StatsBlocks";
import { TrendChart } from "@/components/stats/TrendChart";
import { TeamNav } from "@/components/TeamNav";
import { StatsTeamSelect } from "@/components/stats/StatsTeamSelect";
import { allResults, attackDefense, efficiency, poolTitle, recentForm, streaks, seasonNotStarted, type StandingRow } from "@/lib/domain/standings";
import { getCurrentMember } from "@/lib/member";
import { getLatestSnapshots, getSeasonProgress, getTeamSnapshots } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Stats" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ equipe?: string }> }) {
  const member = (await getCurrentMember())!;
  const supabase = await createClient();
  const { data: teamRows } = await supabase.from("teams").select("id, name, volley34_ref").order("name");
  const teams = teamRows ?? [];
  // Par défaut : la première équipe de l'adhérent ; sans équipe, tout le club.
  const requested = (await searchParams).equipe;
  const selected = requested && (requested === "club" || teams.some((t) => t.id === requested)) ? requested : (member.teams[0]?.id ?? "club");
  const progress = await getSeasonProgress(supabase, teams.map((t) => t.id));

  if (selected === "club") {
    const latest = await getLatestSnapshots(supabase);
    const ranked = [...teams].sort((a, b) => {
      const sa = latest.get(a.id);
      const sb = latest.get(b.id);
      return (sb ? sb.won / Math.max(1, sb.played) : -1) - (sa ? sa.won / Math.max(1, sa.played) : -1) || a.name.localeCompare(b.name, "fr");
    });
    const totals = [...latest.values()].reduce((acc, s) => ({ won: acc.won + s.won, lost: acc.lost + s.lost }), { won: 0, lost: 0 });
    return (
      <main className="page stack">
        <div className="stats-head">
          <h1>Stats</h1>
          <StatsTeamSelect teams={teams} value="club" />
        </div>
        <TeamNav myTeamId={member.teams[0]?.id ?? null} />
        <section className="card stack">
          <h2>Bilan du club</h2>
          {totals.won + totals.lost > 0 ? <WinLoss won={totals.won} lost={totals.lost} /> : <p className="muted small">Les résultats arrivent après les premiers matchs.</p>}
        </section>
        <ul className="team-grid">
          {ranked.map((t) => {
            const s = latest.get(t.id);
            const p = progress.get(t.id)!;
            return (
              <li key={t.id}>
                <Link href={`/stats?equipe=${t.id}`} className="card card-link team-tile">
                  <span className="team-tile-name">{t.name}</span>
                  {s ? (
                    <>
                      <span className="team-tile-rank">{s.rank === 1 ? "1er" : `${s.rank}e`}<small>/{s.poolSize}</small></span>
                      <span className="muted small">{poolTitle(s.rows[0]?.division ?? null, s.rows[0]?.pool ?? null)} · {s.points} pts</span>
                      <WinLoss won={s.won} lost={s.lost} />
                    </>
                  ) : (
                    <span className="muted small">{p.total} matchs au calendrier · classement à venir</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="muted small">Source : volley34.fr, mis à jour chaque matin.</p>
      </main>
    );
  }

  const team = teams.find((t) => t.id === selected)!;
  const snapshots = await getTeamSnapshots(supabase, team.id);
  const latest = snapshots.at(-1) ?? null;
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const fullName = `SMDT/${team.name}`;
  const isMine = (r: StandingRow) => r.code === team.volley34_ref || r.name === fullName;
  const myRow = latest?.rows.find(isMine) ?? null;
  const started = latest ? !seasonNotStarted(latest.rows) : false;
  const form = recentForm(snapshots);
  const results = allResults(snapshots);
  const series = streaks(results);
  const eff = myRow ? efficiency(myRow) : null;

  return (
    <main className="page stack">
      <div className="stats-head">
        <h1>Stats</h1>
        <StatsTeamSelect teams={teams} value={team.id} />
      </div>
      <TeamNav myTeamId={member.teams[0]?.id ?? null} />

      {latest && started ? (
        <>
          <HeroStats s={latest} previous={previous} />
          <section className="card stack">
            <h2>Victoires et défaites</h2>
            <WinLoss won={latest.won} lost={latest.lost} />
          </section>
          {series.current && (
            <section className="card stack">
              <h2>Série en cours</h2>
              <StreakCard s={series} form={form} />
            </section>
          )}
          {myRow && eff && (
            <section className="card stack">
              <h2>Efficacité</h2>
              <Efficiency row={myRow} setsPct={eff.setsPct} pointsPct={eff.pointsPct} />
            </section>
          )}
          {myRow && myRow.played > 0 && (
            <section className="card stack">
              <h2>Scores des matchs</h2>
              <ScoreBreakdown scores={myRow.scores} />
            </section>
          )}
          {myRow && (
            <section className="card stack">
              <h2>Points marqués et encaissés</h2>
              <PointsTotals row={myRow} />
            </section>
          )}
          <section className="card stack">
            <h2>Différence de sets · la poule</h2>
            <SetDiffPool rows={latest.rows} highlight={isMine} />
          </section>
          {attackDefense(latest.rows).length > 1 && (
            <section className="card stack">
              <h2>Attaque et défense</h2>
              <p className="muted small">Points marqués et encaissés par set, chaque équipe de la poule.</p>
              <AttackDefense points={attackDefense(latest.rows).map((p) => ({ ...p, mine: isMine(latest.rows.find((r) => r.name === p.name)!) }))} />
            </section>
          )}
          <section className="card stack">
            <h2>Points dans la poule</h2>
            <PoolComparison rows={latest.rows} highlight={isMine} />
          </section>
          {snapshots.length > 1 && (
            <section className="card stack">
              <h2>Évolution de la saison</h2>
              <p className="muted small">Points au classement</p>
              <TrendChart label="Points au classement" points={snapshots.map((s) => ({ date: s.takenOn, value: s.points }))} />
              <p className="muted small">Différence de sets</p>
              <TrendChart label="Différence de sets" signedValues points={snapshots.map((s) => ({ date: s.takenOn, value: s.setDiff }))} />
            </section>
          )}
          {snapshots.length > 1 && (
            <section className="card stack">
              <h2>Évolution du classement</h2>
              <RankChart points={snapshots.map((s) => ({ date: s.takenOn, rank: s.rank }))} poolSize={latest.poolSize} />
            </section>
          )}
          <section className="card stack">
            <h2>Classement · {poolTitle(latest.rows[0]?.division ?? null, latest.rows[0]?.pool ?? null)}</h2>
            <StandingsTable rows={latest.rows} highlight={isMine} />
          </section>
        </>
      ) : latest ? (
        <>
          <section className="card stack empty-stats">
            <p className="hero-number" aria-hidden="true">0</p>
            <p>
              Pas encore de match joué dans la poule de <strong>{team.name}</strong>. Les statistiques
              apparaîtront après la première journée.
            </p>
          </section>
          <section className="card stack">
            <h2>La poule · {poolTitle(latest.rows[0]?.division ?? null, latest.rows[0]?.pool ?? null)}</h2>
            <ul className="names">
              {latest.rows.map((r) => (
                <li key={r.name} className={isMine(r) ? "strong" : undefined}>{r.name}</li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className="card stack empty-stats">
          <p className="hero-number" aria-hidden="true">–</p>
          <p>
            Le classement de <strong>{team.name}</strong> s&apos;affichera ici après les premiers matchs : il est
            mis à jour chaque matin depuis volley34.fr.
          </p>
        </section>
      )}

      <SeasonCard p={progress.get(team.id)!} />
      <a href="https://www.volley34.fr/Pages/Classements.aspx?C=CH" target="_blank" rel="noopener noreferrer" className="small">
        Classements complets sur volley34.fr ↗
      </a>
    </main>
  );
}
