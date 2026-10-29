import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember, hasRole, ROLE_LABELS, type Role } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { ImportMembersForm } from "./ImportMembersForm";

export const metadata: Metadata = { title: "Adhérents" };

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_id: string | null;
  team: { name: string } | null;
  roles: { role: Role; team: { name: string } | null }[];
};

export default async function AdherentsPage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, user_id, team:teams(name), roles:member_roles(role, team:teams(name))")
    .order("last_name");
  const members = (data ?? []) as unknown as Row[];

  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Adhérents</h1>
      <ImportMembersForm />

      <section className="stack">
        <h2>{members.length} adhérents</h2>
        <ul className="list">
          {members.map((m) => (
            <li key={m.id} className="card member-row">
              <div>
                <p className="member-name">
                  {m.last_name} {m.first_name}
                </p>
                <p className="muted small">
                  {m.team?.name ?? "Sans équipe"}
                  {m.roles
                    .filter((r) => r.role !== "member")
                    .map((r) => ` · ${r.role === "captain" ? "Capitaine" : ROLE_LABELS[r.role]}`)
                    .join("")}
                </p>
              </div>
              <span className={m.user_id ? "badge home" : "badge away"} title={m.email}>
                {m.user_id ? "Compte" : "Sans compte"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
