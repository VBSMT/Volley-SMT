import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourtView, type RosterPlayer } from "@/components/CourtView";
import { formatDay, formatTime } from "@/lib/format";
import { POSITION_LABELS, type Position } from "@/lib/member-types";
import { captainTeamIds, getCurrentMember, hasRole } from "@/lib/member";
import { getLatestSnapshots } from "@/lib/stats";
import { PositionsEditor } from "./PositionsEditor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Équipe" };

/** Fiche équipe : terrain animé avec les joueurs à leur poste, effectif, prochain match. Jamais le niveau. */
export default async function EquipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: team }, { data: roster }, { data: next }, latest] = await Promise.all([
    supabase.from("teams").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("team_roster").select("member_id, first_name, last_name, position_1, position_2, is_captain").eq("team_id", id),
    supabase
      .from("matches")
      .select("id, starts_at, opponent, is_home")
      .eq("team_id", id)
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    getLatestSnapshots(supabase),
  ]);
  if (!team) notFound();
  const me = await getCurrentMember();
  const canEdit = hasRole(me, "board") || captainTeamIds(me).includes(team.id);

  const players = [...(roster ?? [])].sort(
    (a, b) => Number(b.is_captain) - Number(a.is_captain) || a.first_name.localeCompare(b.first_name, "fr"),
  );
  const court: RosterPlayer[] = players.map((p) => ({
    id: p.member_id,
    firstName: p.first_name,
    initials: `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase(),
    position1: p.position_1,
  }));
  const captains = players.filter((p) => p.is_captain).map((p) => `${p.first_name} ${p.last_name[0] ?? ""}.`);
  const s = latest.get(team.id);
  const pos = (p: Position | null) => (p ? POSITION_LABELS[p] : null);

  return (
    <main className="page stack">
      <Link href="/equipes" className="back">← Équipes du club</Link>
      <h1>{team.name}</h1>
      <p className="muted small">
        {captains.length > 0 && `Capitaine : ${captains.join(", ")} · `}
        {players.length} joueur{players.length > 1 ? "s" : ""}
        {s && s.played > 0 && ` · ${s.rank === 1 ? "1er" : `${s.rank}e`} de la poule`}
      </p>

      <section className="card stack">
        <h2>Sur le terrain</h2>
        {court.length ? <CourtView players={court} /> : <p className="muted small">Aucun joueur rattaché à cette équipe.</p>}
      </section>

      {players.length > 0 && (
        <section className="card stack">
          <h2>L&apos;équipe</h2>
          {canEdit ? (
            <>
              <p className="muted small">Capitaine / Bureau : modifiez les postes, enregistrés à chaque changement.</p>
              <PositionsEditor
                players={players.map((p) => ({
                  id: p.member_id,
                  name: `${p.first_name} ${p.last_name[0] ?? ""}.${p.is_captain ? " ©" : ""}`,
                  p1: p.position_1,
                  p2: p.position_2,
                }))}
              />
            </>
          ) : (
          <ul className="roster">
            {players.map((p) => (
              <li key={p.member_id}>
                <span>
                  {p.first_name} {p.last_name[0] ?? ""}.{p.is_captain && <span aria-label="capitaine"> ©</span>}
                </span>
                <span className="muted small">{[pos(p.position_1), pos(p.position_2)].filter(Boolean).join(" / ") || "poste non renseigné"}</span>
              </li>
            ))}
          </ul>
          )}
        </section>
      )}

      {next && (
        <Link href={`/matchs/${next.id}`} className="btn-secondary center">
          Prochain match : {formatDay(next.starts_at)} {formatTime(next.starts_at)} contre {next.opponent} →
        </Link>
      )}
      <Link href={`/stats?equipe=${team.id}`} className="btn-secondary center">
        Stats de l&apos;équipe →
      </Link>
    </main>
  );
}
