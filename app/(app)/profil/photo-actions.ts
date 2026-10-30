"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, hasRole } from "@/lib/member";
import { removePhotoFile } from "@/lib/photos-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 300_000;

/** Type d'image d'après ses premiers octets (WebP, JPEG ou PNG), sinon null. */
function imageType(b: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  return null;
}

/** Photo du joueur (cartes du jeu) : carré préparé dans le navigateur (WebP, ou JPEG sur Safari), droit à l'image requis. */
export async function uploadPhoto(formData: FormData): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  if (!hasRole(member, "board")) return { error: "Réservé au Bureau pour l'instant." };
  if (!member.image_consent) return { error: "Coche d'abord le droit à l'image et enregistre ton profil." };
  const file = formData.get("photo");
  if (!(file instanceof Blob) || file.size > MAX_BYTES) return { error: "Photo trop lourde ou illisible." };
  // Format reconnu au contenu (Safari sur iPhone ne sait pas produire de WebP : JPEG à la place).
  const type = imageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (!type) return { error: "Format de photo non reconnu (JPEG, PNG ou WebP)." };

  const { error } = await createAdminClient()
    .storage.from("photos")
    .upload(`${member.id}.webp`, file, { contentType: type, upsert: true });
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
