import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/domain/csv";
import { getCurrentMember, hasRole, POSITION_LABELS, ROLE_LABELS, type Position, type Role } from "@/lib/member";
import { getCurrentSeason } from "@/lib/season";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Exports CSV du Bureau (données lues avec ses droits : RLS). */
export async function GET(request: NextRequest) {
  if (!hasRole(await getCurrentMember(), "board")) return NextResponse.json({ error: "Réservé au Bureau." }, { status: 403 });
  const type = request.nextUrl.searchParams.get("type");
  const supabase = await createClient();
  const season = await getCurrentSeason(supabase);
  let csv: string;

  if (type === "adherents") {
    const { data } = await supabase
      .from("members")
      .select(
        `last_name, first_name, email, sex, phone, emergency_contact_name, emergency_contact_phone, image_consent,
         position_1, position_2, fsgt_license, dues_paid, member_teams(team:teams(name)), roles:member_roles(role, team:teams(name))`,
      )
      .order("last_name");
    const pos = (p: Position | null) => (p ? POSITION_LABELS[p] : "");
    csv = toCsv(
      ["Nom", "Prénom", "Email", "Sexe", "Téléphone", "Contact urgence", "Tél. urgence", "Droit image", "Poste 1", "Poste 2", "Licence", "Cotisation", "Équipes", "Rôles"],
      (data ?? []).map((m) => [
        m.last_name, m.first_name, m.email, m.sex, m.phone, m.emergency_contact_name, m.emergency_contact_phone, m.image_consent,
        pos(m.position_1), pos(m.position_2), m.fsgt_license, m.dues_paid,
        (m.member_teams as unknown as { team: { name: string } }[]).map((t) => t.team.name).join(", "),
        (m.roles as unknown as { role: Role; team: { name: string } | null }[])
          .filter((r) => r.role !== "member")
          .map((r) => (r.role === "captain" ? `Capitaine ${r.team?.name ?? ""}` : ROLE_LABELS[r.role]))
          .join(", "),
      ]),
    );
  } else if (type === "presences") {
    // Présences de la saison : nombre de « je viens » par adhérent sur les séances passées.
    const from = season?.startsOn ?? "1970-01-01";
    const [{ data: sessions }, { data: members }] = await Promise.all([
      supabase.from("training_sessions").select("id").gte("starts_at", from).lt("starts_at", new Date().toISOString()).gt("open_courts", 0),
      supabase.from("members").select("id, last_name, first_name").order("last_name"),
    ]);
    const ids = (sessions ?? []).map((s) => s.id);
    const { data: answers } = ids.length
      ? await supabase.from("attendance").select("member_id, present").in("session_id", ids)
      : { data: [] as { member_id: string; present: boolean }[] };
    const count = new Map<string, number>();
    for (const a of answers ?? []) if (a.present) count.set(a.member_id, (count.get(a.member_id) ?? 0) + 1);
    csv = toCsv(
      ["Nom", "Prénom", "Présences", "Séances ouvertes", "Taux"],
      (members ?? []).map((m) => {
        const n = count.get(m.id) ?? 0;
        return [m.last_name, m.first_name, n, ids.length, ids.length ? `${Math.round((n / ids.length) * 100)} %` : ""];
      }),
    );
  } else {
    return NextResponse.json({ error: "Export inconnu." }, { status: 400 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="volley-smt-${type}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
