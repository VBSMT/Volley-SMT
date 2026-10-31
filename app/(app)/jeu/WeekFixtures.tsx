"use client";

import { useRef } from "react";

export type FixtureRow = { id: string; day: string; time: string; teamName: string; teamRank: number | null; opponent: string; opponentRank: number | null; isHome: boolean };

const rankLabel = (r: number) => (r === 1 ? "1ᵉʳ" : `${r}ᵉ`);

/** Bouton 📅 et feuille « Matchs de la journée » : oppositions de la semaine et rang de chaque équipe. */
export function WeekFixtures({ title, fixtures }: { title: string; fixtures: FixtureRow[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="fixtures-btn" onClick={() => dialog.current?.showModal()} aria-label={`Matchs de la ${title}`}>
        <span aria-hidden="true">📅</span>
      </button>
      <dialog
        ref={dialog}
        className="fixtures-sheet"
        aria-labelledby="fixtures-title"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="fixtures-head">
          <h2 id="fixtures-title">📅 Matchs de la {title}</h2>
          <button type="button" className="fixtures-close" onClick={() => dialog.current?.close()} aria-label="Fermer">
            ✕
          </button>
        </div>
        {fixtures.length ? (
          <ul className="fixtures-list">
            {fixtures.map((f) => (
              <li key={f.id} className="fixture">
                <span className="fixture-when">
                  <b>{f.day}</b>
                  {f.time}
                  {!f.isHome && <span aria-label="à l'extérieur"> ✈</span>}
                </span>
                <span className="fixture-vs">
                  <span className="fixture-team is-club">
                    {f.teamName}
                    {f.teamRank !== null && <span className="fixture-rank">{rankLabel(f.teamRank)}</span>}
                  </span>
                  <span className="fixture-sep" aria-label={f.isHome ? "reçoit" : "chez"}>{f.isHome ? "vs" : "@"}</span>
                  <span className="fixture-team">
                    {f.opponent}
                    {f.opponentRank !== null && <span className="fixture-rank">{rankLabel(f.opponentRank)}</span>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Aucun match du club cette semaine.</p>
        )}
        <p className="small muted">🔒 Une carte se verrouille au début du match de son équipe.</p>
      </dialog>
    </>
  );
}
