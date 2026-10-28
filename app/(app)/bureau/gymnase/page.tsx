import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, formatMonth } from "@/lib/format";
import { getCurrentMember, hasRole } from "@/lib/member";
import { getSessions, type SessionView } from "@/lib/training";
import { CourtsSelect } from "./CourtsSelect";
import { SeasonForm } from "./SeasonForm";

export const metadata: Metadata = { title: "Gymnase" };

export default async function GymnasePage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();

  const sessions = await getSessions({ from: new Date(Date.now() - 2 * 3600_000), limit: 120 });

  const months = new Map<string, SessionView[]>();
  for (const s of sessions) {
    const key = formatMonth(s.startsAt);
    months.set(key, [...(months.get(key) ?? []), s]);
  }

  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Gymnase</h1>

      {sessions.length === 0 ? (
        <SeasonForm from="2026-09-08" to="2027-06-24" />
      ) : (
        <p className="muted small">
          Terrains ouverts par séance. Les terrains libres déduisent les matchs à domicile et les
          reports validés.
        </p>
      )}

      {[...months].map(([month, list]) => (
        <section key={month} className="stack">
          <h2 className="month">{month}</h2>
          <ul className="list">
            {list.map((s) => (
              <li key={s.id} className={s.openCourts === 0 ? "card gym-row closed" : "card gym-row"}>
                <div>
                  <p className="gym-date">{formatDay(s.startsAt)}</p>
                  <p className="muted small">
                    {s.closedReason ??
                      (s.openCourts === 0
                        ? "Fermé"
                        : `${s.freeCourts} libre${s.freeCourts > 1 ? "s" : ""}${
                            s.homeMatches ? ` · ${s.homeMatches} match${s.homeMatches > 1 ? "s" : ""} à dom.` : ""
                          }`)}
                  </p>
                </div>
                <CourtsSelect sessionId={s.id} value={s.openCourts} label={formatDay(s.startsAt)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
