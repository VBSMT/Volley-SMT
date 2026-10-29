import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendancePoll, VolunteerPoll } from "@/components/EventPolls";
import { EVENT_TYPE_LABELS, visibilityLabel } from "@/lib/domain/events";
import { getEventDetail } from "@/lib/events";
import { formatDay, formatTime } from "@/lib/format";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Événement" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = (await getCurrentMember())!;
  const isBoard = hasRole(member, "board");
  const event = await getEventDetail(await createClient(), id, {
    memberId: member.id,
    canVolunteer: isBoard || hasRole(member, "volunteer"),
  });
  if (!event) notFound();
  const past = Date.parse(event.startsAt) < Date.now();
  const t = event.totals;

  return (
    <main className="page stack">
      <Link href="/evenements" className="back">← Événements</Link>
      <section className="card stack">
        <p className="muted small">
          {EVENT_TYPE_LABELS[event.type]}
          {isBoard && ` · ${visibilityLabel(event.visibleRoles)}`}
        </p>
        <h1>{event.title}</h1>
        <p>
          <span className="match-date-inline">{formatDay(event.startsAt)}</span> à {formatTime(event.startsAt)}
          {event.location && ` · ${event.location}`}
        </p>
        {event.description && <p className="announcement-body">{event.description}</p>}
        {isBoard && (
          <Link href={`/bureau/evenements/${event.id}`} className="small">
            Modifier l&apos;événement
          </Link>
        )}
      </section>

      {event.attendancePoll && (
        <section className="card stack">
          <h2>Présence</h2>
          <AttendancePoll event={event} past={past} />
          <div className="totals" aria-label="Suivi des présences">
            <div><strong>{t.members}</strong><span>adhérent{t.members > 1 ? "s" : ""}</span></div>
            {event.askPartner && <div><strong>{t.partners}</strong><span>conjoint·e{t.partners > 1 ? "s" : ""}</span></div>}
            {event.askChildren && <div><strong>{t.children}</strong><span>enfant{t.children > 1 ? "s" : ""}</span></div>}
            {event.askGuests && <div><strong>{t.guests}</strong><span>invité{t.guests > 1 ? "s" : ""}</span></div>}
            <div className="total"><strong>{t.total}</strong><span>personnes</span></div>
          </div>
          {event.coming.length > 0 && (
            <details>
              <summary>Qui vient ?</summary>
              <ul className="names">
                {event.coming.map((c, i) => (
                  <li key={i}>
                    {c.name} {c.extra && <span className="muted small">{c.extra}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {event.volunteers && (
        <section className="card stack">
          <h2>Participation bénévole</h2>
          {event.volunteers.needs.length > 0 && (
            <ul className="needs">
              {event.volunteers.needs.map((n) => (
                <li key={n.id}>
                  <span>{n.label}</span>
                  <span className="meter" role="img" aria-label={`${n.filled} sur ${n.needed}`}>
                    <span style={{ width: `${Math.min(100, (n.filled / n.needed) * 100)}%` }} />
                  </span>
                  <strong>
                    {n.filled}/{n.needed}
                  </strong>
                </li>
              ))}
            </ul>
          )}
          <VolunteerPoll event={event} past={past} />
          {event.volunteers.signups.some((s) => s.available) && (
            <details>
              <summary>Bénévoles disponibles</summary>
              <ul className="names">
                {event.volunteers.signups
                  .filter((s) => s.available)
                  .map((s, i) => (
                    <li key={i}>
                      {s.name} {s.need && <span className="muted small">· {s.need}</span>}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </main>
  );
}
