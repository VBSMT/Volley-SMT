"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { readSheet } from "read-excel-file/node";
import { parseCsv, parseMemberSheet, type ImportedMember } from "@/lib/domain/member-import";
import { getCurrentMember, hasRole } from "@/lib/member";
import { sendInvitation } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PreviewRow = { name: string; email: string; team: string | null; extra: string; isNew: boolean };

export type MemberImportState = {
  status: "idle" | "preview" | "done" | "error";
  errors?: string[];
  preview?: { created: number; updated: number; rows: PreviewRow[] };
  summary?: { created: number; updated: number; accounts: number; invitations: number; problems: string[] };
};

const MAX_SIZE = 2 * 1024 * 1024;

async function readRows(file: File): Promise<unknown[][]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (/\.xlsx$/i.test(file.name)) return (await readSheet(buffer)) as unknown[][];
  // CSV : UTF-8 (« CSV UTF-8 » d'Excel) ou Windows-1252 (« CSV (séparateur : point-virgule) »).
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    content = new TextDecoder("windows-1252").decode(buffer);
  }
  return parseCsv(content);
}

const ROLE_LABEL = { board: "Bureau", volunteer: "Bénévole" } as const;

function describe(m: ImportedMember) {
  return [
    m.captain && "capitaine",
    ...m.roles.map((r) => ROLE_LABEL[r]),
    m.level !== null && `niveau ${m.level}`,
    m.duesPaid === true && "cotisation réglée",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Étape 1 (aperçu) puis étape 2 (import) avec le même fichier. Tout ou rien en cas d'erreur de lecture. */
export async function importMembers(_prev: MemberImportState, formData: FormData): Promise<MemberImportState> {
  if (!hasRole(await getCurrentMember(), "board")) return { status: "error", errors: ["Réservé au Bureau."] };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", errors: ["Choisissez un fichier Excel (.xlsx) ou CSV."] };
  }
  if (file.size > MAX_SIZE) return { status: "error", errors: ["Fichier trop volumineux (2 Mo max)."] };

  let rows: unknown[][];
  try {
    rows = await readRows(file);
  } catch {
    return { status: "error", errors: ["Fichier illisible : enregistrez-le en .xlsx ou en CSV."] };
  }

  const supabase = await createClient();
  const { data: teams } = await supabase.from("teams").select("id, name");
  const { members, errors } = parseMemberSheet(rows, (teams ?? []).map((t) => t.name));
  if (errors.length) return { status: "error", errors };

  const { data: existingRows, error: readError } = await supabase
    .from("members")
    .select("id, email, user_id, phone")
    .in("email", members.map((m) => m.email));
  if (readError) return { status: "error", errors: ["Lecture des fiches impossible."] };
  const existing = new Map(existingRows.map((e) => [String(e.email).toLowerCase(), e]));

  if (formData.get("mode") !== "import") {
    return {
      status: "preview",
      preview: {
        created: members.filter((m) => !existing.has(m.email)).length,
        updated: members.filter((m) => existing.has(m.email)).length,
        rows: members.map((m) => ({
          name: `${m.firstName} ${m.lastName}`,
          email: m.email,
          team: m.team,
          extra: describe(m),
          isNew: !existing.has(m.email),
        })),
      },
    };
  }

  const teamId = new Map((teams ?? []).map((t) => [t.name, t.id as string]));
  const problems: string[] = [];

  // 1. Fiches : création des nouvelles, mise à jour des existantes (sans écraser le téléphone saisi).
  const toCreate = members.filter((m) => !existing.has(m.email));
  if (toCreate.length) {
    const { data, error } = await supabase
      .from("members")
      .insert(
        toCreate.map((m) => ({
          email: m.email,
          first_name: m.firstName,
          last_name: m.lastName,
          sex: m.sex,
          team_id: m.team ? teamId.get(m.team) : null,
          phone: m.phone,
          fsgt_license: m.license,
          dues_paid: m.duesPaid ?? false,
        })),
      )
      .select("id, email, user_id, phone");
    if (error) return { status: "error", errors: [`Création des fiches impossible : ${error.message}`] };
    data.forEach((e) => existing.set(String(e.email).toLowerCase(), e));
  }
  for (const m of members.filter((x) => !toCreate.includes(x))) {
    const e = existing.get(m.email)!;
    const { error } = await supabase
      .from("members")
      .update({
        first_name: m.firstName,
        last_name: m.lastName,
        sex: m.sex,
        ...(m.team && { team_id: teamId.get(m.team) }),
        ...(m.license && { fsgt_license: m.license }),
        ...(m.duesPaid !== null && { dues_paid: m.duesPaid }),
        ...(m.phone && !e.phone && { phone: m.phone }),
      })
      .eq("id", e.id);
    if (error) problems.push(`${m.email} : mise à jour impossible`);
  }

  // 2. Rôles (ajoutés, jamais retirés par l'import) et niveaux.
  const ids = members.map((m) => existing.get(m.email)!.id as string);
  const { data: currentRoles } = await supabase
    .from("member_roles")
    .select("member_id, role, team_id")
    .in("member_id", ids);
  const has = new Set((currentRoles ?? []).map((r) => `${r.member_id}|${r.role}|${r.team_id ?? ""}`));
  const newRoles = members.flatMap((m) => {
    const id = existing.get(m.email)!.id as string;
    const wanted = [
      ...m.roles.map((role) => ({ member_id: id, role, team_id: null as string | null })),
      ...(m.captain && m.team ? [{ member_id: id, role: "captain", team_id: teamId.get(m.team)! }] : []),
    ];
    return wanted.filter((r) => !has.has(`${r.member_id}|${r.role}|${r.team_id ?? ""}`));
  });
  if (newRoles.length) {
    const { error } = await supabase.from("member_roles").insert(newRoles);
    if (error) problems.push(`Rôles non enregistrés : ${error.message}`);
  }
  const levels = members
    .filter((m) => m.level !== null)
    .map((m) => ({ member_id: existing.get(m.email)!.id, level: m.level!, updated_at: new Date().toISOString() }));
  if (levels.length) {
    const { error } = await supabase.from("member_levels").upsert(levels, { onConflict: "member_id" });
    if (error) problems.push(`Niveaux non enregistrés : ${error.message}`);
  }

  // 3. Comptes de connexion (l'inscription libre est désactivée) : créés ici, rattachés par email.
  const admin = createAdminClient();
  const withoutAccount = members.filter((m) => !existing.get(m.email)!.user_id);
  let knownUsers: Map<string, string> | null = null;
  const invited: { id: string; email: string; first_name: string }[] = [];

  for (const m of withoutAccount) {
    const memberId = existing.get(m.email)!.id as string;
    const { data, error } = await admin.auth.admin.createUser({ email: m.email, email_confirm: true });
    let userId = data?.user?.id ?? null;
    if (error) {
      // Compte déjà existant (ex. invitation manuelle) : on le retrouve et on le rattache.
      if (!knownUsers) {
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
        knownUsers = new Map((list?.users ?? []).map((u) => [String(u.email).toLowerCase(), u.id]));
      }
      userId = knownUsers.get(m.email) ?? null;
      if (!userId) {
        problems.push(`${m.email} : compte non créé (${error.message})`);
        continue;
      }
    }
    await admin.from("members").update({ user_id: userId }).eq("id", memberId).is("user_id", null);
    invited.push({ id: memberId, email: m.email, first_name: m.firstName });
  }

  // 4. Invitations par email, envoyées après la réponse.
  const sendInvites = formData.get("invite") === "on";
  if (sendInvites && invited.length) {
    after(async () => {
      for (const recipient of invited) {
        try {
          await sendInvitation(recipient);
        } catch (e) {
          console.error("Invitation non envoyée", recipient.email, (e as Error).message);
        }
      }
    });
  }

  revalidatePath("/bureau/adherents");
  return {
    status: "done",
    summary: {
      created: toCreate.length,
      updated: members.length - toCreate.length,
      accounts: invited.length,
      invitations: sendInvites ? invited.length : 0,
      problems,
    },
  };
}
