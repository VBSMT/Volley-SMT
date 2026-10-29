import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, formatTime } from "@/lib/format";
import { getCurrentMember, hasRole, POSITION_LABELS, type Position } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { getSessions } from "@/lib/training";
import { RegenerateButton } from "./RegenerateButton";

export const metadata: Metadata = { title: "Compo du soir" };

type StoredTeam = { players: string[]; levelSum: number; girls: number };

export default async function CompoPage() {
  // Compo et niveaux : Bureau uniquement (RLS en base, et écran masqué).
  if (!hasRole(await getCurrentMember(), "board")) notFound();

  const sessions = (await getSessions({ from: new Date(Date.now() - 2 * 3600_000), limit: 6 }))
    .filter((s) => s.freeCourts > 0)
    .slice(0, 2);

  const supabase = await createClient();
  const ids = sessions.map((s) => s.id);
  const [{ data: lineups }, { data: members }, { data: levels }] = await Promise.all([
    supabase.from("lineups").select("session_id, generated_at, free_courts, teams, warnings").in("session_id", ids),
    supabase.from("members").select("id, first_name, last_name, sex, position_1, position_2"),
    supabase.from("member_levels").select("member_id, level"),
  ]);
  const people = new Map((members ?? []).map((m) => [m.id as string, m]));
  const levelOf = new Map((levels ?? []).map((l) => [l.member_id as string, l.level as number]));
  const pos = (p: Position | null) => (p ? POSITION_LABELS[p] : null);

  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Compo du soir</h1>
      <p className="muted small">
        Générée automatiquement à 12h, à la clôture du sondage. Visible par le Bureau uniquement ;
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
                  Calculée le {formatDay(lineup.generated_at)} à {formatTime(lineup.generated_at)}
                  {teams.length % 2 === 1 && " · une équipe au repos à tour de rôle"}
                </p>
                {warnings.length > 0 && (
                  <ul className="notice warnings" role="status">
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                <ol className="lineup">
                  {teams.map((t, k) => (
                    <li key={k} className="card">
                      <h3>
                        Équipe {k + 1} <span className="muted small">· niveau {t.levelSum} · {t.girls} fille{t.girls > 1 ? "s" : ""}</span>
                      </h3>
                      <ul className="lineup-players">
                        {t.players.map((id) => {
                          const m = people.get(id);
                          const positions = [pos(m?.position_1 ?? null), pos(m?.position_2 ?? null)].filter(Boolean).join(" / ");
                          return (
                            <li key={id}>
                              <span>
                                {m ? `${m.first_name} ${m.last_name}` : "Adhérent"} {m?.sex === "F" && <span aria-label="fille">♀</span>}
                              </span>
                              <span className="muted small">
                                {positions || "poste ?"} · {levelOf.get(id) ?? "?"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="muted small">Pas encore calculée (elle le sera à 12h le jour même).</p>
            )}
            <RegenerateButton sessionId={s.id} exists={!!lineup} />
          </section>
        );
      })}
    </main>
  );
}
