import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, formatTime, shortName } from "@/lib/format";
import { getCurrentMember, hasRole, POSITION_LABELS, type Position } from "@/lib/member";
import { getSchedule } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { getSessions } from "@/lib/training";
import { LineupBoard } from "./LineupBoard";
import { TeamCountControls } from "./TeamCountControls";
import { AttendanceEditor } from "./AttendanceEditor";
import { RegenerateButton } from "./RegenerateButton";

export const metadata: Metadata = { title: "Compo du soir" };

type StoredTeam = { players: string[]; levelSum: number; girls: number };

export default async function CompoPage() {
  // Compo et niveaux : Bureau uniquement (RLS en base, et écran masqué).
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  const { closeHour } = await getSchedule(await createClient());

  const sessions = (await getSessions({ from: new Date(Date.now() - 6 * 3600_000), limit: 6 }))
    .filter((s) => s.freeCourts > 0)
    .slice(0, 2);

  const supabase = await createClient();
  const ids = sessions.map((s) => s.id);
  const [{ data: lineups }, { data: members }, { data: levels }, { data: answers }] = await Promise.all([
    supabase.from("lineups").select("session_id, generated_at, free_courts, forced_teams, teams, warnings").in("session_id", ids),
    supabase.from("members").select("id, first_name, last_name, sex, position_1, position_2"),
    supabase.from("member_levels").select("member_id, level"),
    supabase.from("attendance").select("session_id, member_id, present").in("session_id", ids),
  ]);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr");
  const people = new Map((members ?? []).map((m) => [m.id as string, m]));
  const levelOf = new Map((levels ?? []).map((l) => [l.member_id as string, l.level as number]));
  const pos = (p: Position | null) => (p ? POSITION_LABELS[p] : null);

  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Compo du soir</h1>
      <p className="muted small">
        Générée automatiquement à {closeHour}h, à la clôture du sondage (heure réglable dans Paramètres). Visible par le Bureau uniquement ;
        les ajustements de dernière minute se font sur place.
      </p>

      {sessions.length === 0 && <p className="notice">Aucune séance à venir avec des terrains libres.</p>}

      {sessions.map((s) => {
        const lineup = lineups?.find((l) => l.session_id === s.id);
        const teams = (lineup?.teams ?? []) as StoredTeam[];
        const warnings = (lineup?.warnings ?? []) as string[];
        return (
          <section key={s.id} className="stack">
            <h2 className="month">
              {formatDay(s.startsAt)} · {s.present.length} présents · {s.freeCourts} terrain{s.freeCourts > 1 ? "s" : ""}
            </h2>
            {lineup ? (
              <>
                <p className="muted small">
                  Mise à jour le {formatDay(lineup.generated_at)} à {formatTime(lineup.generated_at)}
                  {teams.length % 2 === 1 && " · une équipe au repos à tour de rôle"}
                </p>
                {warnings.length > 0 && (
                  <ul className="notice warnings" role="status">
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                <TeamCountControls
                  sessionId={s.id}
                  count={teams.length}
                  forced={(lineup.forced_teams as number | null) ?? null}
                  present={teams.reduce((n, t) => n + t.players.length, 0)}
                />
                <LineupBoard
                  key={lineup.generated_at}
                  sessionId={s.id}
                  teams={teams.map((t) => t.players)}
                  players={teams.flatMap((t) =>
                    t.players.map((id) => {
                      const m = people.get(id);
                      return {
                        id,
                        name: m ? shortName(m.first_name, m.last_name) : "Adhérent",
                        girl: m?.sex === "F",
                        positions: [pos(m?.position_1 ?? null), pos(m?.position_2 ?? null)].filter(Boolean).join(" / "),
                        level: levelOf.get(id) ?? null,
                      };
                    }),
                  )}
                />
              </>
            ) : (
              <p className="muted small">Pas encore calculée (elle le sera à {closeHour}h le jour même).</p>
            )}
            <AttendanceEditor
              sessionId={s.id}
              present={[...s.present].sort(byName)}
              others={(members ?? [])
                .filter((m) => !s.present.some((p) => p.id === m.id))
                .map((m) => ({
                  id: m.id as string,
                  name: shortName(m.first_name, m.last_name),
                  answer: answers?.find((a) => a.session_id === s.id && a.member_id === m.id) ? false : null,
                }))
                .sort(byName)}
            />
            <RegenerateButton sessionId={s.id} exists={!!lineup} />
          </section>
        );
      })}
    </main>
  );
}
