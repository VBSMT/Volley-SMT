import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentMember, memberTeamIds } from "@/lib/member";
import { getLatestSnapshots } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Équipes du club" };

const initials = (f: string, l: string) => `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();

/** Liste des équipes du club (Stats › Équipes) : rang, effectif, accès à la fiche. */
export default async function EquipesPage() {
  const member = (await getCurrentMember())!;
  const supabase = await createClient();
  const [{ data: teams }, { data: roster }, latest] = await Promise.all([
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("team_roster").select("team_id, first_name, last_name"),
    getLatestSnapshots(supabase),
  ]);
  const mine = new Set(memberTeamIds(member));
  const sorted = [...(teams ?? [])].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.name.localeCompare(b.name, "fr"));

  return (
    <main className="page stack">
      <div className="stats-head">
        <h1>Équipes du club</h1>
        <Link href="/stats" className="small">← Stats</Link>
      </div>
      <ul className="team-grid">
        {sorted.map((t) => {
          const players = (roster ?? []).filter((r) => r.team_id === t.id);
          const s = latest.get(t.id);
          return (
            <li key={t.id}>
              <Link href={`/equipes/${t.id}`} className="card card-link team-tile">
                {mine.has(t.id) && <span className="team-badge">Mon équipe</span>}
                <span className="team-tile-name">{t.name}</span>
                {s && s.played > 0 && (
                  <span className="team-tile-rank">
                    {s.rank === 1 ? "1er" : `${s.rank}e`}
                    <small>/{s.poolSize}</small>
                  </span>
                )}
                <span className="muted small">
                  {players.length} joueur{players.length > 1 ? "s" : ""}
                </span>
                <span className="team-initials" aria-hidden="true">
                  {players.slice(0, 4).map((p, i) => (
                    <i key={i}>{initials(p.first_name, p.last_name)}</i>
                  ))}
                  {players.length > 4 && <i>+{players.length - 4}</i>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
