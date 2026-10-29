import type { FormResult, StandingRow, Streaks } from "@/lib/domain/standings";
import { FormStrip } from "./StatsBlocks";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const dec = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const short = (name: string) => name.replace(/^SMDT\s*\/\s*/i, "");

/** Série en cours (grand chiffre), records de la saison et 5 derniers résultats. */
export function StreakCard({ s, form }: { s: Streaks; form: FormResult[] }) {
  if (!s.current) return null;
  const win = s.current.result === "V";
  const label = win ? `victoire${s.current.count > 1 ? "s" : ""}` : `défaite${s.current.count > 1 ? "s" : ""}`;
  return (
    <div className="stack">
      <div className="streak">
        <span className={`streak-number ${win ? "is-win" : "is-loss"}`}>{s.current.count}</span>
        <div>
          <p className="streak-label">
            {label}
            {s.current.count > 1 ? " de suite" : ""}
          </p>
          <p className="muted small">
            Meilleure série : {s.bestWin} victoire{s.bestWin > 1 ? "s" : ""} · pire : {s.worstLoss} défaite{s.worstLoss > 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <FormStrip form={form} />
      <p className="muted small">Du plus ancien au plus récent →</p>
    </div>
  );
}

function Ring({ pct, label, detail }: { pct: number | null; label: string; detail: string }) {
  return (
    <div className="eff-tile">
      <span className="eff-ring" style={{ ["--p" as string]: pct ?? 0 }} aria-hidden="true" />
      <strong>{pct === null ? "—" : `${pct} %`}</strong>
      <span>
        {label}
        <br />({detail})
      </span>
    </div>
  );
}

/** Efficacité : % de sets et de points gagnés, différences. */
export function Efficiency({ row, setsPct, pointsPct }: { row: StandingRow; setsPct: number | null; pointsPct: number | null }) {
  const nb = (n: number) => n.toLocaleString("fr-FR");
  return (
    <div className="eff-tiles">
      <Ring pct={setsPct} label="sets gagnés" detail={`${row.setsWon} / ${row.setsWon + row.setsLost}`} />
      <Ring pct={pointsPct} label="points gagnés" detail={`${nb(row.pointsWon)} / ${nb(row.pointsWon + row.pointsLost)}`} />
      <div className="eff-tile">
        <strong>{signed(row.setDiff)}</strong>
        <span>différence de sets</span>
        <strong className="eff-second">{signed(row.pointDiff)}</strong>
        <span>différence de points</span>
      </div>
    </div>
  );
}

/** Différence de sets de chaque équipe de la poule : barres divergentes autour de zéro, valeurs écrites. */
export function SetDiffPool({ rows, highlight }: { rows: StandingRow[]; highlight: (r: StandingRow) => boolean }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.setDiff)));
  const sorted = [...rows].sort((a, b) => b.setDiff - a.setDiff);
  return (
    <figure className="chart">
      <ul className="diverging" aria-label="Différence de sets par équipe">
        {sorted.map((r) => {
          const w = `${(Math.abs(r.setDiff) / max) * 100}%`;
          return (
            <li key={r.name} className={highlight(r) ? "mine" : undefined} title={`${short(r.name)} : ${signed(r.setDiff)} sets`}>
              <span className="div-name">{short(r.name)}</span>
              <span className="div-track">
                <span className="div-half div-neg">
                  {r.setDiff < 0 && (
                    <>
                      <span className="div-value">{r.setDiff}</span>
                      <span className="div-bar loss" style={{ width: w }} />
                    </>
                  )}
                </span>
                <span className="div-half div-pos">
                  {r.setDiff >= 0 && (
                    <>
                      <span className="div-bar win" style={{ width: r.setDiff ? w : "2px" }} />
                      <span className="div-value">{signed(r.setDiff)}</span>
                    </>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <details className="chart-data">
        <summary>Voir en tableau</summary>
        <table>
          <thead><tr><th>Équipe</th><th>Sets G/P</th><th>Diff.</th></tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.name}><td>{short(r.name)}</td><td>{r.setsWon} / {r.setsLost}</td><td>{signed(r.setDiff)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Points marqués et encaissés : totaux et moyenne par set. */
export function PointsTotals({ row }: { row: StandingRow }) {
  const sets = row.setsWon + row.setsLost;
  const max = Math.max(1, row.pointsWon, row.pointsLost);
  const line = (label: string, v: number, cls: string) => (
    <div className="pts-row">
      <p className="pts-label">{label}</p>
      <div className="pts-line">
        <span className={`pts-bar ${cls}`} style={{ width: `${(v / max) * 70}%` }} />
        <span className="pts-value">
          {v.toLocaleString("fr-FR")} pts{sets > 0 && ` · ${dec(v / sets)}/set`}
        </span>
      </div>
    </div>
  );
  return (
    <div className="stack">
      {line("Marqués", row.pointsWon, "win")}
      {line("Encaissés", row.pointsLost, "loss")}
    </div>
  );
}
