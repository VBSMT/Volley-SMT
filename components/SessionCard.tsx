import { PollButtons } from "@/components/PollButtons";
import { formatDay, formatTime } from "@/lib/format";
import type { MyMatch, SessionView } from "@/lib/training";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Match d'une équipe de l'adhérent le jour de la séance. */
function MatchClash({ matches, comingAnyway }: { matches: MyMatch[]; comingAnyway: boolean }) {
  if (!matches.length) return null;
  return (
    <>
      {matches.map((m) => (
        <div key={m.startsAt + m.teamName} className="match-clash" role="note">
          <span className="match-clash-icon" aria-hidden="true">🏐</span>
          <div>
            <strong>Attention, tu as match !</strong>
            <p className="small">
              {m.isHome ? `${m.teamName} reçoit ${m.opponent} · ${formatTime(m.startsAt)}, ici` : `${m.teamName} chez ${m.opponent}${m.venue ? ` (${m.venue})` : ""} · ${formatTime(m.startsAt)}`}
            </p>
          </div>
        </div>
      ))}
      {comingAnyway && <p className="small">Tu as répondu « je viens » : pense à modifier ta réponse si tu joues le match.</p>}
    </>
  );
}

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
        <MatchClash matches={s.myMatches} comingAnyway={false} />
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
      <MatchClash matches={s.myMatches} comingAnyway={s.myAnswer === true} />
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
