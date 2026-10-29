import Link from "next/link";
import { poolTitle, zoneOf, type FormResult, type StandingRow, type Zone } from "@/lib/domain/standings";
import { formatDay, formatTime } from "@/lib/format";
import type { SeasonProgress, Snapshot } from "@/lib/stats";

const ZONE: Record<Exclude<Zone, null>, { icon: string; label: string; cls: string }> = {
  gold: { icon: "🥇", label: "1er", cls: "zone-up" },
  silver: { icon: "🥈", label: "2e", cls: "zone-up" },
  bronze: { icon: "🥉", label: "3e", cls: "zone-up" },
  promotion: { icon: "▲", label: "Montée", cls: "zone-up" },
  relegation: { icon: "▼", label: "Descente", cls: "zone-down" },
};

const dec = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

/** Chiffres clés : rang en héros, puis points et différences. */
export function HeroStats({ s, previous }: { s: Snapshot; previous: Snapshot | null }) {
  const division = s.rows[0]?.division ?? null;
  const zone = zoneOf(s.rank, s.poolSize, division, s.rows[0] ?? {});
  const delta = previous ? previous.rank - s.rank : 0;
  return (
    <section className="stats-hero">
      <div className="hero-rank">
        <span className="hero-number">{ordinal(s.rank)}</span>
        <span className="hero-sub">sur {s.poolSize} · {poolTitle(division, s.rows[0]?.pool ?? null)}</span>
        <span className="hero-badges">
          {zone && (
            <span className={`zone ${ZONE[zone].cls}`}>
              <span aria-hidden="true">{ZONE[zone].icon}</span> {zone === "promotion" || zone === "relegation" ? `Zone ${ZONE[zone].label.toLowerCase()}` : "Podium"}
            </span>
          )}
          {delta !== 0 && (
            <span className={delta > 0 ? "zone zone-up" : "zone zone-down"}>
              <span aria-hidden="true">{delta > 0 ? "▲" : "▼"}</span> {delta > 0 ? `+${delta}` : delta} place{Math.abs(delta) > 1 ? "s" : ""}
            </span>
          )}
        </span>
      </div>
      <dl className="kpis">
        <div><dt>Points</dt><dd>{s.points}</dd></div>
        <div><dt>Matchs</dt><dd>{s.played}</dd></div>
        <div><dt>Diff. sets</dt><dd>{signed(s.setDiff)}</dd></div>
        <div><dt>Diff. points</dt><dd>{signed(s.pointDiff)}</dd></div>
      </dl>
    </section>
  );
}

/** Victoires / défaites : barre empilée, comptes écrits (jamais la couleur seule). */
export function WinLoss({ won, lost }: { won: number; lost: number }) {
  const total = won + lost;
  if (!total) return null;
  return (
    <div className="winloss">
      <div className="winloss-bar" role="img" aria-label={`${won} victoires, ${lost} défaites`}>
        {won > 0 && <span className="win" style={{ flexGrow: won }} title={`${won} victoire${won > 1 ? "s" : ""}`} />}
        {lost > 0 && <span className="loss" style={{ flexGrow: lost }} title={`${lost} défaite${lost > 1 ? "s" : ""}`} />}
      </div>
      <div className="winloss-legend">
        <span><i className="dot-win" aria-hidden="true" /> {won} victoire{won > 1 ? "s" : ""}</span>
        <span><i className="dot-loss" aria-hidden="true" /> {lost} défaite{lost > 1 ? "s" : ""}</span>
        <span className="muted">{Math.round((won / total) * 100)} %</span>
      </div>
    </div>
  );
}

/** Classement de la poule, l'équipe du club surlignée. */
export function StandingsTable({ rows, highlight }: { rows: StandingRow[]; highlight: (r: StandingRow) => boolean }) {
  const size = rows.length;
  return (
    <div className="table-wrap">
      <table className="standings">
        <thead>
          <tr>
            <th scope="col"><abbr title="Rang">#</abbr></th>
            <th scope="col" className="left">Équipe</th>
            <th scope="col"><abbr title="Joués">J</abbr></th>
            <th scope="col"><abbr title="Gagnés">G</abbr></th>
            <th scope="col"><abbr title="Perdus">P</abbr></th>
            <th scope="col"><abbr title="Différence de sets">DS</abbr></th>
            <th scope="col"><abbr title="Points">Pts</abbr></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const zone = zoneOf(r.rank, size, r.division, r);
            const mine = highlight(r);
            return (
              <tr key={r.name} className={mine ? "mine" : undefined}>
                <td>
                  <span className={`rank ${zone ? ZONE[zone].cls : ""}`} title={zone ? ZONE[zone].label : undefined}>
                    {r.rank}
                  </span>
                </td>
                <td className="left team-cell">
                  {r.name.replace(/^SMDT\s*\/\s*/i, "")}
                  {zone && <span className="sr-only"> ({ZONE[zone].label})</span>}
                </td>
                <td>{r.played}</td>
                <td>{r.won}</td>
                <td>{r.lost}</td>
                <td>{signed(r.setDiff)}</td>
                <td className="pts">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="legend-line muted small">
        <span className="zone-up">▲</span> montée / podium · <span className="zone-down">▼</span> descente
      </p>
    </div>
  );
}

/** Avancement de la saison et prochain match. */
export function SeasonCard({ p }: { p: SeasonProgress }) {
  const pct = p.total ? Math.round((p.played / p.total) * 100) : 0;
  return (
    <section className="card stack season-lines">
      <h2>Saison</h2>
      <div className="progress" role="img" aria-label={`${p.played} matchs joués sur ${p.total}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="small">
        <strong>{p.played}</strong> joué{p.played > 1 ? "s" : ""} sur {p.total} · {p.home} à domicile, {p.away} à l&apos;extérieur
      </p>
      {p.next && (
        <p className="small">
          Prochain : <span className="match-date-inline">{formatDay(p.next.startsAt)}</span> à {formatTime(p.next.startsAt)} contre{" "}
          <Link href={`/matchs/${p.next.id}`} className="match-link">{p.next.opponent}</Link> ({p.next.isHome ? "dom." : "ext."})
        </p>
      )}
    </section>
  );
}

/** Forme récente : pastilles V/D (lettre + couleur, jamais la couleur seule). */
export function FormStrip({ form }: { form: FormResult[] }) {
  if (!form.length) return null;
  return (
    <ol className="form-strip" aria-label="Derniers résultats, du plus ancien au plus récent">
      {form.map((f, i) => (
        <li key={i} className={f.result === "V" ? "form-win" : "form-loss"} title={`${f.result === "V" ? "Victoire" : "Défaite"} · ${f.date}`}>
          {f.result}
        </li>
      ))}
    </ol>
  );
}

const SCORE_BARS = [
  { key: "s30", label: "3-0", win: true },
  { key: "s31", label: "3-1", win: true },
  { key: "s32", label: "3-2", win: true },
  { key: "s23", label: "2-3", win: false },
  { key: "s13", label: "1-3", win: false },
  { key: "s03", label: "0-3", win: false },
] as const;

/** Répartition des scores : histogramme victoires (vert) / défaites (rouge), valeurs écrites. */
export function ScoreBreakdown({ scores }: { scores: StandingRow["scores"] }) {
  const max = Math.max(1, ...SCORE_BARS.map((b) => scores[b.key]));
  const forfeits = scores.fWon + scores.fLost;
  return (
    <div className="stack">
      <div className="score-chart" role="img" aria-label={SCORE_BARS.map((b) => `${b.label} : ${scores[b.key]}`).join(", ")}>
        {SCORE_BARS.map((b) => (
          <div key={b.key} className="score-col" title={`${scores[b.key]} match${scores[b.key] > 1 ? "s" : ""} ${b.win ? "gagné" : "perdu"}${scores[b.key] > 1 ? "s" : ""} ${b.label}`}>
            <span className="score-value">{scores[b.key]}</span>
            <span className={b.win ? "score-bar win" : "score-bar loss"} style={{ height: `${(scores[b.key] / max) * 100}%` }} />
            <span className="score-label">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="winloss-legend">
        <span><i className="dot-win" aria-hidden="true" /> victoires</span>
        <span><i className="dot-loss" aria-hidden="true" /> défaites</span>
        {forfeits > 0 && <span className="muted">forfaits : {scores.fWon} gagné{scores.fWon > 1 ? "s" : ""}, {scores.fLost} perdu{scores.fLost > 1 ? "s" : ""}</span>}
      </p>
    </div>
  );
}

function Duel({ label, won, lost, wonLabel, lostLabel }: { label: string; won: number; lost: number; wonLabel: string; lostLabel: string }) {
  const total = won + lost;
  return (
    <div className="duel">
      <p className="duel-title">{label}</p>
      <div className="winloss-bar" role="img" aria-label={`${won} ${wonLabel}, ${lost} ${lostLabel}`}>
        {won > 0 && <span className="win" style={{ flexGrow: won }} />}
        {lost > 0 && <span className="loss" style={{ flexGrow: lost }} />}
        {!total && <span className="empty" style={{ flexGrow: 1 }} />}
      </div>
      <p className="duel-values">
        <span><strong>{won}</strong> {wonLabel}</span>
        <span><strong>{lost}</strong> {lostLabel}</span>
      </p>
    </div>
  );
}

/** Sets et points : gagnés contre perdus, et moyenne de points marqués par set. */
export function SetsAndPoints({ row }: { row: StandingRow }) {
  const sets = row.setsWon + row.setsLost;
  return (
    <div className="stack">
      <Duel label="Sets" won={row.setsWon} lost={row.setsLost} wonLabel="gagnés" lostLabel="perdus" />
      <Duel label="Points" won={row.pointsWon} lost={row.pointsLost} wonLabel="marqués" lostLabel="encaissés" />
      {sets > 0 && (
        <p className="small">
          <strong>{dec(row.pointsWon / sets)}</strong> points marqués par set en moyenne,{" "}
          <strong>{dec(row.pointsLost / sets)}</strong> encaissés.
        </p>
      )}
    </div>
  );
}

/** Points de chaque équipe de la poule : la nôtre en noir, les autres en retrait, valeurs écrites. */
export function PoolComparison({ rows, highlight }: { rows: StandingRow[]; highlight: (r: StandingRow) => boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.points));
  return (
    <ul className="pool-bars">
      {rows.map((r) => (
        <li key={r.name} className={highlight(r) ? "mine" : undefined}>
          <span className="pool-name">{r.name.replace(/^SMDT\s*\/\s*/i, "")}</span>
          <span className="pool-track">
            <span className="pool-bar" style={{ width: `${Math.max(2, (r.points / max) * 100)}%` }} />
          </span>
          <span className="pool-value">{r.points}</span>
        </li>
      ))}
    </ul>
  );
}
