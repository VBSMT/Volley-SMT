"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, hasRole } from "@/lib/member";
import { duesFields, getCurrentSeason } from "@/lib/season";
import { deleteMemberAndAccount } from "@/lib/purge-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EditState = { status: "idle" | "saved" | "error"; message?: string };

const text = (fd: FormData, key: string, max = 100) => {
  const v = String(fd.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return v === "" ? null : v;
};

/**
 * Le Bureau met à jour une fiche : identité, licence, cotisation, équipes, capitanats,
 * rôles et niveau. Les équipes et rôles cochés remplacent les précédents.
 */
export async function updateMember(memberId: string, _prev: EditState, fd: FormData): Promise<EditState> {
  const me = await getCurrentMember();
  if (!hasRole(me, "board")) return { status: "error", message: "Réservé au Bureau." };

  const firstName = text(fd, "first_name");
  const lastName = text(fd, "last_name");
  const sex = String(fd.get("sex") ?? "");
  if (!firstName || !lastName || !["F", "M"].includes(sex)) {
    return { status: "error", message: "Nom, prénom et sexe sont obligatoires." };
  }
  const teams = fd.getAll("teams").map(String);
  const captainOf = fd.getAll("captain").map(String).filter((t) => teams.includes(t));
  const roles = fd.getAll("roles").map(String).filter((r) => r === "board" || r === "volunteer");
  const levelText = String(fd.get("level") ?? "");
  const level = levelText === "" ? null : Number(levelText);
  if (level !== null && !(Number.isInteger(level) && level >= 1 && level <= 5)) {
    return { status: "error", message: "Niveau : 1 à 5." };
  }
  // Éviter de se retirer soi-même du Bureau (plus personne ne pourrait gérer l'appli).
  if (me!.id === memberId && !roles.includes("board")) {
    return { status: "error", message: "Vous ne pouvez pas retirer votre propre rôle Bureau." };
  }

  const supabase = await createClient();

  // Email : corrigeable tant que l'adhérent ne s'est jamais connecté (erreur à l'import).
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (email) {
    const result = await changeEmail(memberId, email);
    if (result) return { status: "error", message: result };
  }

  const { error } = await supabase
    .from("members")
    .update({
      first_name: firstName,
      last_name: lastName,
      sex,
      fsgt_license: text(fd, "fsgt_license", 30),
      ...duesFields(fd.get("dues_paid") === "on", await getCurrentSeason(supabase)),
    })
    .eq("id", memberId);
  if (error) return { status: "error", message: "Enregistrement de la fiche impossible." };

  // Équipes : on remplace par la sélection.
  const { error: e1 } = await supabase.from("member_teams").delete().eq("member_id", memberId);
  const { error: e2 } = teams.length
    ? await supabase.from("member_teams").insert(teams.map((team_id) => ({ member_id: memberId, team_id })))
    : { error: null };

  // Rôles : Bureau, bénévole et capitanats remplacés ; le rôle « adhérent » n'est pas touché.
  const { error: e3 } = await supabase
    .from("member_roles")
    .delete()
    .eq("member_id", memberId)
    .in("role", ["board", "volunteer", "captain"]);
  const newRoles = [
    ...roles.map((role) => ({ member_id: memberId, role, team_id: null as string | null })),
    ...captainOf.map((team_id) => ({ member_id: memberId, role: "captain", team_id })),
  ];
  const { error: e4 } = newRoles.length ? await supabase.from("member_roles").insert(newRoles) : { error: null };

  // Niveau (Bureau uniquement).
  const { error: e5 } =
    level === null
      ? await supabase.from("member_levels").delete().eq("member_id", memberId)
      : await supabase
          .from("member_levels")
          .upsert({ member_id: memberId, level, updated_at: new Date().toISOString() }, { onConflict: "member_id" });

  if (e1 || e2 || e3 || e4 || e5) return { status: "error", message: "Enregistrement partiel : réessayez." };
  revalidatePath("/bureau/adherents");
  revalidatePath(`/bureau/adherents/${memberId}`);
  return { status: "saved" };
}

/** Le Bureau supprime définitivement une fiche, ses réponses et son compte de connexion. */
export async function deleteMember(memberId: string): Promise<{ error?: string }> {
  const me = await getCurrentMember();
  if (!hasRole(me, "board")) return { error: "Réservé au Bureau." };
  if (me!.id === memberId) return { error: "Vous ne pouvez pas supprimer votre propre fiche." };

  const admin = createAdminClient();
  const { data: m } = await admin.from("members").select("id, user_id").eq("id", memberId).maybeSingle();
  if (!m) return { error: "Adhérent introuvable." };
  const error = await deleteMemberAndAccount(admin, m.id, m.user_id);
  if (error) return { error: `Suppression impossible : ${error}` };
  revalidatePath("/", "layout");
  return {};
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Change l'email d'un adhérent qui ne s'est jamais connecté : fiche, et compte de connexion s'il
 * a déjà été créé (invitation). Refusé après une première connexion. Renvoie l'erreur éventuelle.
 */
async function changeEmail(memberId: string, email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: m } = await admin.from("members").select("email, user_id").eq("id", memberId).maybeSingle();
  if (!m || (m.email as string).toLowerCase() === email) return null;
  if (!EMAIL.test(email) || email.length > 254) return "Email invalide.";
  if (m.user_id) {
    const { data: u } = await admin.auth.admin.getUserById(m.user_id as string);
    if (u?.user?.last_sign_in_at) return "Email non modifiable : cet adhérent s'est déjà connecté avec.";
  }
  const { error } = await admin.from("members").update({ email }).eq("id", memberId);
  if (error) return error.code === "23505" ? "Cet email est déjà utilisé par une autre fiche." : "Changement d'email impossible.";
  if (m.user_id) {
    const { error: e2 } = await admin.auth.admin.updateUserById(m.user_id as string, { email, email_confirm: true });
    if (e2) {
      await admin.from("members").update({ email: m.email }).eq("id", memberId);
      return "Changement d'email impossible (compte de connexion).";
    }
  }
  return null;
}
