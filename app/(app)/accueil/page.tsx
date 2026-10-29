import type { Metadata } from "next";
import Link from "next/link";
import { MatchPoll } from "@/components/MatchPoll";
import { NotificationToggle } from "@/components/NotificationToggle";
import { ReinforcementCard } from "@/components/ReinforcementCard";
import { SessionCard } from "@/components/SessionCard";
import { captainTeamIds, getCurrentMember, hasRole } from "@/lib/member";
import { formatDay, formatTime } from "@/lib/format";
import { getMatchPoll } from "@/lib/match-polls";
import { getOpenReinforcements } from "@/lib/reinforcements";
import { createClient } from "@/lib/supabase/server";
import { getSessions } from "@/lib/training";

export const metadata: Metadata = { title: "Accueil" };

export default async function AccueilPage() {
  const member = (await getCurrentMember())!;
  // Prochaine séance avec au moins un terrain libre.
  const upcoming = await getSessions({
    from: new Date(Date.now() - 2 * 3600_000),
    limit: 10,
    memberId: member.id,
  });
  const next = upcoming.find((s) => s.freeCourts > 0);
  const myCaptainTeams = captainTeamIds(member);
  // Prochain match de mon équipe (et son sondage de présence s'il est lancé).
  const supabase = await createClient();
  const { data: nextMatch } = member.team_id
    ? await supabase
        .from("matches")
        .select("id, team_id, starts_at, opponent, is_home")
        .eq("team_id", member.team_id)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(1)
        .maybeSingle()
    : { data: null };
  const canManageNext = !!nextMatch && myCaptainTeams.includes(nextMatch.team_id);
  const nextPoll = nextMatch
    ? await getMatchPoll({ id: nextMatch.id, teamId: nextMatch.team_id }, { memberId: member.id, canManage: canManageNext })
    : null;

  const reinforcements = await getOpenReinforcements({
    memberId: member.id,
    isBoard: hasRole(member, "board"),
    captainTeamIds: myCaptainTeams,
  });

  return (
    <main className="page stack">
      <h1>Bonjour {member.first_name}</h1>
      <NotificationToggle compact />
      {nextMatch && (
        <section className="stack">
          <h2>Prochain match · {member.team?.name}</h2>
          <div className="card stack">
            <p>
              <span className={nextMatch.is_home ? "badge home" : "badge away"}>{nextMatch.is_home ? "Dom." : "Ext."}</span>{" "}
              <span className="match-date-inline">{formatDay(nextMatch.starts_at)}</span> à {formatTime(nextMatch.starts_at)}{" "}
              contre{" "}
              <Link href={`/matchs/${nextMatch.id}`} className="match-link">
                {nextMatch.opponent}
              </Link>
            </p>
            {nextPoll && (nextPoll.launched || canManageNext) && (
              <MatchPoll poll={nextPoll} canAnswer canManage={canManageNext} past={false} />
            )}
          </div>
        </section>
      )}

      {reinforcements.length > 0 && (
        <section className="stack">
          <h2>Renforts recherchés</h2>
          <ul className="list">
            {reinforcements.map((r) => (
              <ReinforcementCard key={r.id} request={r} myTeamId={member.team_id} />
            ))}
          </ul>
        </section>
      )}
      {myCaptainTeams.length > 0 && (
        <Link href="/renforts/nouveau" className="btn-secondary center">
          Demander un renfort pour mon équipe
        </Link>
      )}

      <section className="stack">
        <h2>Prochain entraînement</h2>
        {next ? (
          <ul className="list">
            <SessionCard session={next} />
          </ul>
        ) : (
          <p className="notice">Aucun entraînement programmé prochainement.</p>
        )}
        <Link href="/entrainements" className="small">
          Toutes les séances →
        </Link>
      </section>
      <section className="card stack">
        <h2>Prochain événement</h2>
        <p className="muted">Aucun événement prévu pour l&apos;instant.</p>
      </section>
      {!member.phone && (
        <Link href="/profil" className="notice">
          Complétez votre profil : téléphone, contact d&apos;urgence, postes.
        </Link>
      )}
    </main>
  );
}
