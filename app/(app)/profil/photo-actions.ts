"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, hasRole } from "@/lib/member";
import { removePhotoFile } from "@/lib/photos-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 200_000;

/** Photo du joueur (cartes du jeu) : WebP carré préparé dans le navigateur, droit à l'image requis. */
export async function uploadPhoto(formData: FormData): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  if (!hasRole(member, "board")) return { error: "Réservé au Bureau pour l'instant." };
  if (!member.image_consent) return { error: "Coche d'abord le droit à l'image et enregistre ton profil." };
  const file = formData.get("photo");
  if (!(file instanceof Blob) || file.type !== "image/webp" || file.size > MAX_BYTES) return { error: "Photo invalide." };

  const { error } = await createAdminClient()
    .storage.from("photos")
    .upload(`${member.id}.webp`, file, { contentType: "image/webp", upsert: true });
  if (error) return { error: "Envoi impossible. Réessayez." };
  const supabase = await createClient();
  await supabase.from("members").update({ photo_updated_at: new Date().toISOString() }).eq("id", member.id);
  revalidatePath("/", "layout");
  return {};
}

export async function deletePhoto(): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  await removePhotoFile(member.id);
  revalidatePath("/", "layout");
  return {};
}
