import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RescheduleButtons } from "@/components/RescheduleActions";
import { nextStatuses, STATUS_LABELS, type RescheduleStatus } from "@/lib/domain/reschedule";
import { formatDay, formatTime } from "@/lib/format";
import { getCurrentMember, hasRole } from "@/lib/member";
import { getRescheduleEvents, getReschedules, type RescheduleView } from "@/lib/reschedule-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

function RescheduleCard({ r }: { r: RescheduleView }) {
  return (
    <li className="card stack">
      <p>
        <strong>{r.match.teamName}</strong> contre{" "}
        <Link href={`/matchs/${r.match.id}`} className="match-link">
          {r.match.opponent}
        </Link>
      </p>
      <p className="small">
        <span className="match-date-inline">{formatDay(r.match.startsAt)}</span> →{" "}
        <strong className="match-date-inline">
          {formatDay(r.slot.startsAt)} {formatTime(r.slot.startsAt)}
        </strong>
      </p>
      <p className="muted small">
        {STATUS_LABELS[r.status]}
        {r.requestedBy && ` · demandé par ${r.requestedBy}`} · le {formatDay(r.createdAt)}
      </p>
      {r.note && <p className="quote">« {r.note} »</p>}
      <RescheduleButtons requestId={r.id} next={nextStatuses(r.status, "board")} />
    </li>
  );
}

export default async function ReportsPage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  const supabase = await createClient();
  const [all, events] = await Promise.all([getReschedules(supabase, { limit: 200 }), getRescheduleEvents(supabase)]);
  const byStatus = (s: RescheduleStatus[]) => all.filter((r) => s.includes(r.status));
  const pending = byStatus(["requested"]);
  // Décisions modifiables tant que le report n'est pas confirmé (matchs à venir).
  const decided = byStatus(["approved", "rejected"]).filter((r) => Date.parse(r.slot.startsAt) > Date.now());
  const label = new Map(all.map((r) => [r.id, `${r.match.teamName} – ${r.match.opponent}`]));

  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Reports de match</h1>
      <p className="muted small">
        Le Bureau ne gère que le gymnase : une validation pré-réserve un terrain (déduit des
        entraînements) jusqu&apos;à ce que volley34 confirme la nouvelle date. Sans confirmation à
        J-3, la pré-réservation est libérée automatiquement.
      </p>

      <section className="stack">
        <h2>En attente ({pending.length})</h2>
        {pending.length ? (
          <ul className="list">{pending.map((r) => <RescheduleCard key={r.id} r={r} />)}</ul>
        ) : (
          <p className="muted small">Aucune demande en attente.</p>
        )}
      </section>

      {decided.length > 0 && (
        <section className="stack">
          <h2>Décisions modifiables ({decided.length})</h2>
          <ul className="list">{decided.map((r) => <RescheduleCard key={r.id} r={r} />)}</ul>
        </section>
      )}

      <section className="stack">
        <h2>Historique</h2>
        {events.length ? (
          <ul className="history">
            {events.map((e) => (
              <li key={e.id}>
                <span className="muted small">
                  {formatDay(e.at)} {formatTime(e.at)}
                </span>
                <span>
                  {label.get(e.requestId) ?? "Report"} : <strong>{STATUS_LABELS[e.to]}</strong>
                </span>
                <span className="muted small">par {e.actor}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Aucun report pour l&apos;instant.</p>
        )}
      </section>
    </main>
  );
}
