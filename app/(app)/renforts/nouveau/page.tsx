import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, formatTime } from "@/lib/format";
import { captainTeamIds, getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { RequestForm } from "../RequestForm";

export const metadata: Metadata = { title: "Demander un renfort" };

export default async function NewReinforcementPage({ searchParams }: { searchParams: Promise<{ match?: string }> }) {
  const teamIds = captainTeamIds(await getCurrentMember());
  if (!teamIds.length) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("id, starts_at, opponent, is_home, team:teams(name)")
    .in("team_id", teamIds)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(30);
  const matches = (data ?? []).map((m) => ({
    id: m.id as string,
    label: `${formatDay(m.starts_at)} ${formatTime(m.starts_at)} · ${(m.team as unknown as { name: string }).name} – ${m.opponent} (${m.is_home ? "Dom." : "Ext."})`,
  }));

  return (
    <main className="page stack">
      <Link href="/matchs" className="back">← Matchs</Link>
      <h1>Demander un renfort</h1>
      {matches.length ? (
        <RequestForm matches={matches} defaultMatchId={(await searchParams).match} />
      ) : (
        <p className="notice">Aucun match à venir pour votre équipe.</p>
      )}
    </main>
  );
}
