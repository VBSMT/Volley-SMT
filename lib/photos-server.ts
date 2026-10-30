import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Supprime la photo du jeu d'un adhérent (fichier et version). Appelants : vérifier les droits avant. */
export async function removePhotoFile(memberId: string) {
  const admin = createAdminClient();
  await admin.storage.from("photos").remove([`${memberId}.webp`]);
  await admin.from("members").update({ photo_updated_at: null }).eq("id", memberId);
}
