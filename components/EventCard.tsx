import Link from "next/link";
import { EVENT_TYPE_LABELS, visibilityLabel } from "@/lib/domain/events";
import type { EventSummary } from "@/lib/events";
import { formatDay, formatTime } from "@/lib/format";

export function EventCard({ event: e, showVisibility = false }: { event: EventSummary; showVisibility?: boolean }) {
  return (
    <li>
      <Link href={`/evenements/${e.id}`} className="card card-link event-card">
        <div className="event-date" aria-hidden="true">
          <span>{new Date(e.startsAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric" })}</span>
          <span>{new Date(e.startsAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", month: "short" })}</span>
        </div>
        <div>
          <p className="muted small">{EVENT_TYPE_LABELS[e.type]}</p>
          <h3>{e.title}</h3>
          <p className="small">
            <span className="match-date-inline">{formatDay(e.startsAt)}</span> à {formatTime(e.startsAt)}
            {e.location && ` · ${e.location}`}
          </p>
          {showVisibility && e.visibleRoles.length > 0 && <p className="muted small">Visible : {visibilityLabel(e.visibleRoles)}</p>}
        </div>
      </Link>
    </li>
  );
}
