import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember, hasRole, POSITION_LABELS, type Position } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { DeleteMemberButton } from "./DeleteMemberButton";
import { MemberForm } from "./MemberForm";

export const metadata: Metadata = { title: "Fiche adhérent" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentMember();
  if (!hasRole(me, "board")) notFound();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: m }, { data: teams }, { data: level }] = await Promise.all([
    supabase
      .from("members")
      .select(
        `id, first_name, last_name, email, sex, phone, emergency_contact_name, emergency_contact_phone,
         image_consent, position_1, position_2, fsgt_license, dues_paid, user_id,
         member_teams(team_id), roles:member_roles(role, team_id)`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("member_levels").select("level").eq("member_id", id).maybeSingle(),
  ]);
  if (!m) notFound();
  const roles = m.roles as { role: string; team_id: string | null }[];
  const pos = (p: Position | null) => (p ? POSITION_LABELS[p] : "—");

  return (
    <main className="page stack">
      <Link href="/bureau/adherents" className="back">← Adhérents</Link>
      <h1>
        {m.first_name} {m.last_name}
      </h1>

      <section className="card">
        <h2>Renseigné par l&apos;adhérent</h2>
        <dl className="facts">
          <dt>Email</dt>
          <dd>{m.email}</dd>
          <dt>Compte</dt>
          <dd>{m.user_id ? "Créé" : "Pas encore de compte"}</dd>
          <dt>Téléphone</dt>
          <dd>{m.phone ?? "—"}</dd>
          <dt>Urgence</dt>
          <dd>{[m.emergency_contact_name, m.emergency_contact_phone].filter(Boolean).join(" · ") || "—"}</dd>
          <dt>Postes</dt>
          <dd>
            {pos(m.position_1)} / {pos(m.position_2)}
          </dd>
          <dt>Droit à l&apos;image</dt>
          <dd>{m.image_consent ? "Oui" : "Non"}</dd>
        </dl>
      </section>

      <MemberForm
        teams={teams ?? []}
        member={{
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          sex: m.sex,
          fsgt_license: m.fsgt_license,
          dues_paid: m.dues_paid,
          teamIds: (m.member_teams as { team_id: string }[]).map((t) => t.team_id),
          captainOf: roles.filter((r) => r.role === "captain" && r.team_id).map((r) => r.team_id!),
          roles: roles.map((r) => r.role),
          level: level?.level ?? null,
        }}
      />
      {me?.id !== m.id && <DeleteMemberButton id={m.id} name={`${m.first_name} ${m.last_name}`} />}
    </main>
  );
}
