import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay } from "@/lib/format";
import { getCurrentMember, hasRole, ROLE_LABELS, type Role } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { ImportMembersForm } from "./ImportMembersForm";
import { TeamFilter } from "./TeamFilter";
import { VolunteerRequests } from "./VolunteerRequests";

export const metadata: Metadata = { title: "Adhérents" };

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_id: string | null;
  member_teams: { team: { name: string } }[];
  roles: { role: Role; team: { name: string } | null }[];
};

export default async function AdherentsPage({ searchParams }: { searchParams: Promise<{ equipe?: string }> }) {
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  const filter = (await searchParams).equipe ?? "";

  const supabase = await createClient();
  const [{ data }, { data: teams }, { data: requests }] = await Promise.all([
    supabase
      .from("members")
      .select("id, first_name, last_name, email, user_id, member_teams(team:teams(name)), roles:member_roles(role, team:teams(name))")
      .order("last_name"),
    supabase.from("teams").select("name").order("name"),
    supabase
      .from("volunteer_requests")
      .select("id, created_at, member:members!volunteer_requests_member_id_fkey(first_name, last_name)")
      .eq("status", "pending")
      .order("created_at"),
  ]);
  const all = (data ?? []) as unknown as Row[];
  const teamsOf = (m: Row) => m.member_teams.map((t) => t.team.name).sort((a, b) => a.localeCompare(b, "fr"));
  const members =
    filter === "" ? all : filter === "aucune" ? all.filter((m) => !m.member_teams.length) : all.filter((m) => teamsOf(m).includes(filter));

  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Adhérents</h1>

      {!!requests?.length && (
        <VolunteerRequests
          requests={requests.map((r) => {
            const m = r.member as unknown as { first_name: string; last_name: string };
            return { id: r.id, name: `${m.first_name} ${m.last_name}`, at: `demandé le ${formatDay(r.created_at)}` };
          })}
        />
      )}

      <section className="stack">
        <h2>
          {members.length} adhérent{members.length > 1 ? "s" : ""}
        </h2>
        <TeamFilter teams={(teams ?? []).map((t) => t.name)} value={filter} />
        <ul className="list">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/bureau/adherents/${m.id}`} className="card member-row card-link">
                <div>
                  <p className="member-name">
                    {m.last_name} {m.first_name}
                  </p>
                  <p className="muted small">
                    {teamsOf(m).join(", ") || "Sans équipe"}
                    {m.roles
                      .filter((r) => r.role !== "member")
                      .map((r) => ` · ${r.role === "captain" ? `Capitaine ${r.team?.name ?? ""}` : ROLE_LABELS[r.role]}`)
                      .join("")}
                  </p>
                </div>
                <span className={m.user_id ? "badge home" : "badge away"}>{m.user_id ? "Compte" : "Sans compte"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ImportMembersForm />
    </main>
  );
}
