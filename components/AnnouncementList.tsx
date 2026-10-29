import { DeleteAnnouncementButton } from "@/components/DeleteAnnouncementButton";
import type { AnnouncementView } from "@/lib/announcements";
import { formatDay, formatTime } from "@/lib/format";

export function AnnouncementList({ items, canDelete = false }: { items: AnnouncementView[]; canDelete?: boolean }) {
  return (
    <ul className="list">
      {items.map((a) => (
        <li key={a.id} id={a.id} className="card stack announcement">
          <h3>{a.title}</h3>
          <p className="announcement-body">{a.body}</p>
          <p className="muted small">
            {a.author ?? "Le Bureau"} · {formatDay(a.createdAt)} {formatTime(a.createdAt)} · {a.audience}
          </p>
          {canDelete && <DeleteAnnouncementButton id={a.id} />}
        </li>
      ))}
    </ul>
  );
}
