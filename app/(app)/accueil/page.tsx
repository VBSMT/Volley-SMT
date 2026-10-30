import type { Metadata } from "next";
import Link from "next/link";
import { MatchPoll } from "@/components/MatchPoll";
import { CelebrationCards } from "@/components/CelebrationCard";
import { SeasonPodium } from "@/components/game/SeasonPodium";
import { getCelebrations } from "@/lib/stats";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NotificationToggle } from "@/components/NotificationToggle";
import { AnnouncementList } from "@/components/AnnouncementList";
import { EventCard } from "@/components/EventCard";
import { volley34EntryUrl } from "@/lib/domain/volley34";
import { getEvents } from "@/lib/events";
import { ReinforcementCard } from "@/components/ReinforcementCard";
import { getAnnouncements } from "@/lib/announcements";
import { SessionCard } from "@/components/SessionCard";
import { captainTeamIds, getCurrentMember, hasRole, memberTeamIds } from "@/lib/member";
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
  // Prochain match de chacune de mes équipes (et son sondage de présence s'il est lancé).
  const supabase = await createClient();
  const myTeamIds = memberTeamIds(member);
  const { data: upcomingMatches } = myTeamIds.length
    ? await supabase
        .from("matches")
        .select("id, team_id, starts_at, opponent, is_home")
        .in("team_id", myTeamIds)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(30)
    : { data: [] };
  const nextMatches = await Promise.all(
    member.teams
      .map((team) => ({ team, match: (upcomingMatches ?? []).find((m) => m.team_id === team.id) }))
      .filter((x): x is { team: { id: string; name: string }; match: NonNullable<typeof x.match> } => !!x.match)
      .map(async ({ team, match }) => {
        const canManage = myCaptainTeams.includes(team.id);
        const poll = await getMatchPoll({ id: match.id, teamId: team.id }, { memberId: member.id, canManage });
        return { team, match, canManage, poll };
      }),
  );

  // Bureau : demandes en attente (bénévolat).
  const isBoard = hasRole(member, "board");
  const [{ count: pendingVolunteers }, { count: pendingReschedules }] = isBoard
    ? await Promise.all([
        supabase.from("volunteer_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reschedule_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
      ])
    : [{ count: 0 }, { count: 0 }];

  // Prochain événement visible par l'adhérent.
  const [nextEvent] = await getEvents(supabase, { limit: 1 });

  // Annonces des 14 derniers jours (les 3 plus récentes).
  const announcements = await getAnnouncements(supabase, { limit: 3, since: new Date(Date.now() - 14 * 86_400_000) });

  // Victoires des dernières 48 h : félicitations éphémères, pour tout le club.
  const celebrations = await getCelebrations(supabase);

  const reinforcements = await getOpenReinforcements({
    memberId: member.id,
    isBoard,
    captainTeamIds: myCaptainTeams,
  });

  return (
    <main className="page stack">
      <h1>Bonjour {member.first_name}</h1>
      {celebrations.length > 0 && <CelebrationCards items={celebrations} />}
      {/* VUT réservé au Bureau pour l'instant : podium de fin de saison pour ses joueurs. */}
      {isBoard && <SeasonPodium client={supabase} />}
      <InstallPrompt />
      <NotificationToggle compact />
      {!!pendingReschedules && (
        <Link href="/bureau/reports" className="notice">
          {pendingReschedules} demande{pendingReschedules > 1 ? "s" : ""} de report en attente →
        </Link>
      )}
      {!!pendingVolunteers && (
        <Link href="/bureau/adherents#benevoles" className="notice">
          {pendingVolunteers} demande{pendingVolunteers > 1 ? "s" : ""} « Devenir bénévole » en attente →
        </Link>
      )}
      {announcements.length > 0 && (
        <section className="stack">
          <h2>Annonces</h2>
          <AnnouncementList items={announcements} />
          <Link href="/annonces" className="small">
            Toutes les annonces →
          </Link>
        </section>
      )}

      {nextMatches.map(({ team, match, canManage, poll }) => (
        <section key={team.id} className="stack">
          <h2>Prochain match · {team.name}</h2>
          <div className="card stack">
            <p>
              <span className={match.is_home ? "badge home" : "badge away"}>{match.is_home ? "Dom." : "Ext."}</span>{" "}
              <span className="match-date-inline">{formatDay(match.starts_at)}</span> à {formatTime(match.starts_at)}{" "}
              contre{" "}
              <Link href={`/matchs/${match.id}`} className="match-link">
                {match.opponent}
              </Link>
            </p>
            {poll && (poll.launched || canManage) && <MatchPoll poll={poll} canAnswer canManage={canManage} past={false} />}
          </div>
        </section>
      ))}

      {reinforcements.length > 0 && (
        <section className="stack">
          <h2>Renforts recherchés</h2>
          <ul className="list">
            {reinforcements.map((r) => (
              <ReinforcementCard key={r.id} request={r} myTeamIds={myTeamIds} />
            ))}
          </ul>
        </section>
      )}
      {myCaptainTeams.length > 0 && (
        <section className="stack" aria-label="Actions capitaine">
          <a href={volley34EntryUrl(null)} target="_blank" rel="noopener noreferrer" className="btn-primary center">
            Saisir un résultat ↗
          </a>
          <Link href="/renforts/nouveau" className="btn-secondary center">
            Demander un renfort pour mon équipe
          </Link>
        </section>
      )}

      <section className="stack" data-tour="next-session">
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
      <section className="stack">
        <h2>Prochain événement</h2>
        {nextEvent ? (
          <ul className="list">
            <EventCard event={nextEvent} />
          </ul>
        ) : (
          <p className="muted">Aucun événement prévu pour l&apos;instant.</p>
        )}
      </section>
      {!member.phone && (
        <Link href="/profil" className="notice">
          Complétez votre profil : téléphone, contact d&apos;urgence, postes.
        </Link>
      )}
    </main>
  );
}
