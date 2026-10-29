import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchPoll } from "@/components/MatchPoll";
import { RescheduleButtons, RescheduleRequestForm } from "@/components/RescheduleActions";
import { Volley34EntryLink } from "@/components/Volley34EntryLink";
import { ACTIVE, nextStatuses, STATUS_LABELS } from "@/lib/domain/reschedule";
import { formatDay, formatTime } from "@/lib/format";
import { getMatchPoll } from "@/lib/match-polls";
import { captainTeamIds, getCurrentMember, hasRole, memberTeamIds } from "@/lib/member";
import { getReschedules } from "@/lib/reschedule-server";
import { DirectionsLink } from "@/components/DirectionsLink";
import { getDirections } from "@/lib/gyms";
import { createClient } from "@/lib/supabase/server";
import { getSessions } from "@/lib/training";

export const metadata: Metadata = { title: "Match" };

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = (await getCurrentMember())!;
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("matches")
    .select("id, team_id, starts_at, opponent, is_home, competition, division, venue, city, team:teams(name)")
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();

  const canManage = captainTeamIds(member).includes(m.team_id) || hasRole(member, "board");
  const inTeam = memberTeamIds(member).includes(m.team_id);
  const past = Date.parse(m.starts_at) <= Date.now();
  const poll = inTeam || canManage ? await getMatchPoll({ id: m.id, teamId: m.team_id }, { memberId: member.id, canManage }) : null;
  const teamName = (m.team as unknown as { name: string } | null)?.name ?? "";

  // Reports : seulement pour un match à domicile (notre gymnase), géré par le capitaine ou le Bureau.
  const isBoard = hasRole(member, "board");
  const reschedules = m.is_home && canManage ? await getReschedules(supabase, { matchId: m.id }) : [];
  const active = reschedules.find((r) => ACTIVE.includes(r.status));
  const slots =
    m.is_home && canManage && !past && !active
      ? (await getSessions({ from: new Date(), limit: 40 }))
          .filter((s) => s.freeCourts > 0)
          .map((s) => ({
            id: s.id,
            label: `${formatDay(s.startsAt)} ${formatTime(s.startsAt)} · ${s.freeCourts} terrain${s.freeCourts > 1 ? "s" : ""} libre${s.freeCourts > 1 ? "s" : ""}`,
          }))
      : [];

  return (
    <main className="page stack">
      <Link href="/matchs" className="back">← Matchs</Link>
      <section className="card stack">
        <p className="muted small">
          {m.competition}
          {m.division && ` · ${m.division}`}
        </p>
        <h1 className="match-title">
          {teamName} <span className="muted">contre</span> {m.opponent}
        </h1>
        <p>
          <span className={m.is_home ? "badge home" : "badge away"}>{m.is_home ? "Domicile" : "Extérieur"}</span>{" "}
          <span className="match-date-inline">{formatDay(m.starts_at)}</span> à {formatTime(m.starts_at)}
        </p>
        {(m.venue || m.city) && (
          <p className="muted">
            {[m.venue, m.city].filter(Boolean).join(", ")}
            {!m.is_home && <DirectionsLink url={(await getDirections(supabase))(m.venue, m.city)} />}
          </p>
        )}
        {canManage && <Volley34EntryLink competition={m.competition} />}
      </section>

      {m.is_home && canManage && (
        <section className="card stack">
          <h2>Report du match</h2>
          {active ? (
            <>
              <p>
                <span className={active.status === "approved" ? "badge home" : "badge away"}>{STATUS_LABELS[active.status]}</span>{" "}
                vers le <span className="match-date-inline">{formatDay(active.slot.startsAt)}</span> à {formatTime(active.slot.startsAt)}
              </p>
              {active.note && <p className="quote">« {active.note} »</p>}
              {active.status === "approved" && (
                <p className="notice small">
                  Créneau pré-réservé : pensez à déclarer le report sur volley34 une fois accepté par
                  l&apos;adversaire. Il sera confirmé automatiquement dès que volley34 affichera la nouvelle date.
                </p>
              )}
              <RescheduleButtons requestId={active.id} next={nextStatuses(active.status, isBoard ? "board" : "captain")} />
            </>
          ) : past ? (
            <p className="muted small">Match passé.</p>
          ) : (
            <RescheduleRequestForm matchId={m.id} slots={slots} />
          )}
          {reschedules.filter((r) => r !== active).length > 0 && (
            <details>
              <summary>Demandes précédentes</summary>
              <ul className="names">
                {reschedules
                  .filter((r) => r !== active)
                  .map((r) => (
                    <li key={r.id}>
                      {formatDay(r.slot.startsAt)} : {STATUS_LABELS[r.status]}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {poll && (
        <section className="card stack">
          <h2>Présence de l&apos;équipe</h2>
          <MatchPoll poll={poll} canAnswer={inTeam} canManage={canManage} past={past} />
        </section>
      )}
    </main>
  );
}
