import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchPoll } from "@/components/MatchPoll";
import { formatDay, formatTime } from "@/lib/format";
import { getMatchPoll } from "@/lib/match-polls";
import { captainTeamIds, getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

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
  const inTeam = member.team_id === m.team_id;
  const past = Date.parse(m.starts_at) <= Date.now();
  const poll = inTeam || canManage ? await getMatchPoll({ id: m.id, teamId: m.team_id }, { memberId: member.id, canManage }) : null;
  const teamName = (m.team as unknown as { name: string } | null)?.name ?? "";

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
        {(m.venue || m.city) && <p className="muted">{[m.venue, m.city].filter(Boolean).join(", ")}</p>}
      </section>

      {poll && (
        <section className="card stack">
          <h2>Présence de l&apos;équipe</h2>
          <MatchPoll poll={poll} canAnswer={inTeam} canManage={canManage} past={past} />
        </section>
      )}
    </main>
  );
}
