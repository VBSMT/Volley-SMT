import { PollButtons } from "@/components/PollButtons";
import { formatDay } from "@/lib/format";
import type { SessionView } from "@/lib/training";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function SessionCard({ session: s }: { session: SessionView }) {
  const title = `${formatDay(s.startsAt)} · 20h–22h`;

  if (s.openCourts === 0) {
    return (
      <li className="card session closed">
        <h2>{title}</h2>
        <p className="muted">Pas d&apos;entraînement{s.closedReason ? ` — ${s.closedReason}` : ""}.</p>
      </li>
    );
  }

  if (s.freeCourts === 0) {
    return (
      <li className="card session closed">
        <h2>{title}</h2>
        <p className="muted">
          Aucun terrain libre : {plural(s.homeMatches, "match")} à domicile
          {s.approvedReschedules > 0 && ` et ${plural(s.approvedReschedules, "report")}`}.
        </p>
      </li>
    );
  }

  return (
    <li className="card session stack">
      <div className="session-head">
        <h2>{title}</h2>
        <span className="courts">{plural(s.freeCourts, "terrain")}</span>
      </div>
      {s.homeMatches > 0 && (
        <p className="muted small">
          {plural(s.homeMatches, "terrain")} pris par {s.homeMatches > 1 ? "des matchs" : "un match"} à domicile.
        </p>
      )}
      {s.approvedReschedules > 0 && (
        <p className="muted small">
          {plural(s.approvedReschedules, "terrain")} pré-réservé{s.approvedReschedules > 1 ? "s" : ""} pour un match reporté.
        </p>
      )}
      {s.pendingReschedules > 0 && (
        <p className="pending-report small">
          ⏳ {s.pendingReschedules > 1 ? `${s.pendingReschedules} reports en attente` : "Un report en attente"} de confirmation : un terrain pourrait être pris.
        </p>
      )}

      {s.pollOpen ? (
        <PollButtons sessionId={s.id} answer={s.myAnswer} />
      ) : (
        <p className="small">
          Sondage clos
          {s.myAnswer !== null && ` · vous avez répondu « ${s.myAnswer ? "je viens" : "je ne viens pas"} »`}.
        </p>
      )}

      <details>
        <summary>
          {plural(s.present.length, "présent")}
          {s.absentCount > 0 && ` · ${plural(s.absentCount, "absent")}`}
        </summary>
        {s.present.length > 0 ? (
          <ul className="names">
            {s.present.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Personne pour l&apos;instant.</p>
        )}
      </details>
    </li>
  );
}
