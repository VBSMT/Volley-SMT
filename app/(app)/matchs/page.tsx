import type { Metadata } from "next";
import Link from "next/link";
import { formatDay, formatMonth, formatTime } from "@/lib/format";
import { captainTeamIds, getCurrentMember } from "@/lib/member";
import { getDirections } from "@/lib/gyms";
import { createClient } from "@/lib/supabase/server";
import { Volley34EntryLink } from "@/components/Volley34EntryLink";
import { CalendarSubscribe } from "@/components/CalendarSubscribe";
import { DirectionsLink } from "@/components/DirectionsLink";
import { TeamSelect } from "./TeamSelect";

export const metadata: Metadata = { title: "Matchs" };

type Match = {
  id: string;
  starts_at: string;
  is_home: boolean;
  opponent: string;
  competition: string;
  division: string | null;
  venue: string | null;
  city: string | null;
  team: { id: string; name: string } | null;
};

export default async function MatchsPage({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string; passes?: string }>;
}) {
  const params = await searchParams;
  const member = (await getCurrentMember())!;
  const supabase = await createClient();

  const [{ data: teams }, { data: lastSync }, directions] = await Promise.all([
    supabase.from("teams").select("id, name, volley34_ref").order("name"),
    // Visible par tout adhérent : seulement la date de la dernière synchro réussie (vue dédiée).
    supabase.from("last_successful_sync").select("finished_at").maybeSingle(),
    getDirections(supabase),
  ]);
  const staleSince =
    lastSync?.finished_at && Date.now() - Date.parse(lastSync.finished_at) > 36 * 3600_000
      ? new Date(lastSync.finished_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" })
      : null;
  // Par défaut : l'équipe de l'adhérent ; sans équipe, tout le club.
  const myTeamId = member.teams[0]?.id;
  const selected = params.equipe ?? myTeamId ?? "tout";
  const showPast = params.passes === "1";

  let query = supabase
    .from("matches")
    .select("id, starts_at, is_home, opponent, competition, division, venue, city, team:teams(id, name)")
    .order("starts_at", { ascending: !showPast });
  query = showPast
    ? query.lt("starts_at", new Date().toISOString())
    : query.gte("starts_at", new Date(Date.now() - 3 * 3600_000).toISOString());
  if (selected !== "tout") query = query.eq("team_id", selected);
  const { data } = await query;
  const matches = (data ?? []) as unknown as Match[];

  // Regroupement par mois.
  const months = new Map<string, Match[]>();
  for (const m of matches) {
    const key = formatMonth(m.starts_at);
    months.set(key, [...(months.get(key) ?? []), m]);
  }

  const myCaptainTeams = captainTeamIds(member);
  const toggleHref = `/matchs?equipe=${selected}${showPast ? "" : "&passes=1"}`;

  return (
    <main className="page stack">
      <h1>Matchs</h1>
      {staleSince && (
        <p className="notice" role="status">
          Calendrier non mis à jour depuis le {staleSince} : dates à vérifier sur volley34.fr.
        </p>
      )}
      <TeamSelect teams={teams ?? []} value={selected} />
      {(() => {
        const team = teams?.find((t) => t.id === selected);
        return team?.volley34_ref ? <CalendarSubscribe code={team.volley34_ref} teamName={team.name} /> : null;
      })()}
      <Link href={toggleHref} className="small">
        {showPast ? "← Matchs à venir" : "Voir les matchs passés"}
      </Link>

      {matches.length === 0 && (
        <p className="notice">{showPast ? "Aucun match passé." : "Aucun match à venir."}</p>
      )}

      {[...months].map(([month, list]) => (
        <section key={month} className="stack">
          <h2 className="month">{month}</h2>
          <ul className="list">
            {list.map((m) => (
              <li key={m.id} className="card match">
                <div className="match-date">
                  <span>{formatDay(m.starts_at)}</span>
                  <strong>{formatTime(m.starts_at)}</strong>
                </div>
                <div className="match-body">
                  {selected === "tout" && <p className="match-team">{m.team?.name}</p>}
                  <p className="match-opponent">
                    <span className={m.is_home ? "badge home" : "badge away"}>
                      {m.is_home ? "Dom." : "Ext."}
                    </span>{" "}
                    <Link href={`/matchs/${m.id}`} className="match-link">
                      {m.opponent}
                    </Link>
                    {!m.is_home && !showPast && " "}
                    {!m.is_home && !showPast && <DirectionsLink url={directions(m.venue, m.city)} />}
                  </p>
                  <p className="muted small">
                    {m.competition}
                    {m.division && ` · ${m.division}`}
                  </p>
                  {!m.is_home && (m.venue || m.city) && (
                    <p className="muted small">
                      {[m.venue, m.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {!showPast && m.team && myCaptainTeams.includes(m.team.id) && (
                    <p className="captain-links">
                      <Link href={`/matchs/${m.id}`} className="small renfort-link">
                        Sondage de présence
                      </Link>
                      {m.is_home && (
                        <Link href={`/matchs/${m.id}`} className="small renfort-link">
                          Report
                        </Link>
                      )}
                      <Link href={`/renforts/nouveau?match=${m.id}`} className="small renfort-link">
                        Demander un renfort
                      </Link>
                      <Volley34EntryLink competition={m.competition} variant="link" />
                    </p>
                  )}
                  {/* Après le match : saisie du résultat sur volley34. */}
                  {showPast && m.team && myCaptainTeams.includes(m.team.id) && (
                    <p className="captain-links">
                      <Volley34EntryLink competition={m.competition} variant="link" />
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <a href="https://www.volley34.fr" target="_blank" rel="noopener noreferrer" className="small">
        Classements et résultats sur volley34.fr ↗
      </a>
    </main>
  );
}
