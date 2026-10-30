import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, shortName } from "@/lib/format";
import { getCurrentMember, hasRole, ROLE_LABELS, type Role } from "@/lib/member";
import { SETUP_LABELS, setupStatus, type SetupStatus } from "@/lib/domain/setup-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ImportMembersForm } from "./ImportMembersForm";
import { RemindButton } from "./RemindButton";
import { TeamFilter } from "./TeamFilter";
import { VolunteerRequests } from "./VolunteerRequests";

export const metadata: Metadata = { title: "Adhérents" };

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_id: string | null;
  onboarding_done_at?: string | null;
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
      .select("id, first_name, last_name, email, user_id, onboarding_done_at, member_teams(team:teams(name)), roles:member_roles(role, team:teams(name))")
      .order("last_name"),
    supabase.from("teams").select("name").order("name"),
    supabase
      .from("volunteer_requests")
      .select("id, created_at, member:members!volunteer_requests_member_id_fkey(first_name, last_name)")
      .eq("status", "pending")
      .order("created_at"),
  ]);
  const all = (data ?? []) as unknown as Row[];

  // Dernière connexion (comptes Auth, lus côté serveur avec la clé de service, Bureau uniquement).
  const lastSignIn = new Map<string, string | null>();
  const { data: users } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  for (const u of users?.users ?? []) lastSignIn.set(u.id, u.last_sign_in_at ?? null);
  const statusOf = (m: Row): SetupStatus =>
    setupStatus({
      hasAccount: !!m.user_id,
      lastSignInAt: m.user_id ? (lastSignIn.get(m.user_id) ?? null) : null,
      onboardingDoneAt: m.onboarding_done_at ?? null,
    });
  const counts = all.reduce((acc, m) => ({ ...acc, [statusOf(m)]: (acc[statusOf(m)] ?? 0) + 1 }), {} as Partial<Record<SetupStatus, number>>);
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
            return { id: r.id, name: shortName(m.first_name, m.last_name), at: `demandé le ${formatDay(r.created_at)}` };
          })}
        />
      )}

      <section className="stack">
        <h2>
          {members.length} adhérent{members.length > 1 ? "s" : ""}
        </h2>
        <ul className="setup-summary" aria-label="Installation de l'appli">
          {(["configured", "connected", "never", "no_account"] as SetupStatus[]).map((s) => (
            <li key={s} className={`setup-badge setup-${s}`}>
              {SETUP_LABELS[s]} : {counts[s] ?? 0}
            </li>
          ))}
        </ul>
        <RemindButton count={(counts.never ?? 0) + (counts.no_account ?? 0)} />
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
                <span className={`setup-badge setup-${statusOf(m)}`}>{SETUP_LABELS[statusOf(m)]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ImportMembersForm />
    </main>
  );
}
