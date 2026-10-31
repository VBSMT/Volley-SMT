"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/member";
import { NOTIFICATION_PREFS, type NotificationPref, type Position } from "@/lib/member-types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPositionChange } from "@/lib/game-positions";
import { after } from "next/server";
import { removePhotoFile } from "@/lib/photos-server";

export type ProfileState = { status: "idle" | "saved" | "error"; message?: string };

const POSITIONS: Position[] = ["setter", "front", "front_right", "front_left", "back"];

function text(formData: FormData, key: string, max = 100) {
  const value = String(formData.get(key) ?? "").trim().slice(0, max);
  return value === "" ? null : value;
}

function position(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return POSITIONS.includes(value as Position) ? (value as Position) : null;
}

/** Seuls les champs modifiables par l'adhérent sont envoyés ; la base refuse les autres. */
export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const member = await getCurrentMember();
  if (!member) return { status: "error", message: "Session expirée. Reconnectez-vous." };

  const position_1 = position(formData, "position_1");
  let position_2 = position(formData, "position_2");
  if (position_2 === position_1) position_2 = null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({
      phone: text(formData, "phone", 20),
      emergency_contact_name: text(formData, "emergency_contact_name"),
      emergency_contact_phone: text(formData, "emergency_contact_phone", 20),
      image_consent: formData.get("image_consent") === "on",
      position_1,
      position_2,
    })
    .eq("id", member.id);

  if (error) return { status: "error", message: "Enregistrement impossible. Réessayez." };
  // Poste changé : les joueurs VUT qui l'ont dans leur compo sont prévenus (après la réponse).
  if (position_1 !== member.position_1 || position_2 !== member.position_2) after(() => notifyPositionChange(createAdminClient(), member.id));
  // Droit à l'image retiré : la photo du jeu est effacée (la base remet déjà sa version à zéro).
  if (formData.get("image_consent") !== "on" && member.photo_updated_at) await removePhotoFile(member.id);
  revalidatePath("/", "layout");
  return { status: "saved" };
}

export async function requestVolunteer(): Promise<ProfileState> {
  const member = await getCurrentMember();
  if (!member) return { status: "error", message: "Session expirée. Reconnectez-vous." };

  const supabase = await createClient();
  const { error } = await supabase.from("volunteer_requests").insert({ member_id: member.id });
  // 23505 : une demande est déjà en attente.
  if (error && error.code !== "23505") {
    return { status: "error", message: "Envoi impossible. Réessayez." };
  }
  revalidatePath("/profil");
  return { status: "saved" };
}

export async function updateNotificationPref(key: NotificationPref, value: boolean): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  if (!NOTIFICATION_PREFS.some((p) => p.key === key)) return { error: "Préférence inconnue." };

  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ [key]: value }).eq("id", member.id);
  if (error) return { error: "Enregistrement impossible. Réessayez." };
  revalidatePath("/profil");
  return {};
}
