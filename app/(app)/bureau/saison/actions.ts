"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCurrentMember, hasRole } from "@/lib/member";
import { notifyMembers } from "@/lib/notify";
import { duesFields, getCurrentSeason } from "@/lib/season";
import { createClient } from "@/lib/supabase/server";

async function board() {
  return hasRole(await getCurrentMember(), "board");
}

export async function setDues(memberId: string, paid: boolean): Promise<{ error?: string }> {
  if (!(await board())) return { error: "Réservé au Bureau." };
  const supabase = await createClient();
  const season = await getCurrentSeason(supabase);
  const { error } = await supabase.from("members").update(duesFields(paid, season)).eq("id", memberId);
  if (error) return { error: "Enregistrement impossible." };
  revalidatePath("/bureau/saison");
  return {};
}

export async function setLicense(memberId: string, license: string): Promise<{ error?: string }> {
  if (!(await board())) return { error: "Réservé au Bureau." };
  const supabase = await createClient();
  const season = await getCurrentSeason(supabase);
  const clean = license.trim().slice(0, 30) || null;
  const { error } = await supabase
    .from("members")
    .update({ fsgt_license: clean, license_season_id: clean ? (season?.id ?? null) : null })
    .eq("id", memberId);
  if (error) return { error: "Enregistrement impossible." };
  revalidatePath("/bureau/saison");
  return {};
}

/** Relance (notification, sinon email) des adhérents sans cotisation ou sans licence. */
export async function sendReminder(kind: "dues" | "license", text: string): Promise<{ error?: string; count?: number }> {
  if (!(await board())) return { error: "Réservé au Bureau." };
  const body = text.trim().slice(0, 600);
  if (!body) return { error: "Message obligatoire." };
  const supabase = await createClient();
  let q = supabase.from("members").select("id, email, first_name").not("user_id", "is", null);
  q = kind === "dues" ? q.eq("dues_paid", false) : q.is("fsgt_license", null);
  const { data, error } = await q;
  if (error) return { error: "Lecture des adhérents impossible." };
  const recipients = data ?? [];
  const title = kind === "dues" ? "Cotisation à régler" : "Licence FSGT à compléter";
  after(async () => {
    await notifyMembers(recipients.map((recipient) => ({ recipient, message: { title, body, url: "/profil" } })));
  });
  return { count: recipients.length };
}
