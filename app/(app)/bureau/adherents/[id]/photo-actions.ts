"use server";

import { removePhotoFile } from "@/lib/photos-server";
import { getCurrentMember, hasRole } from "@/lib/member";

export async function removeMemberPhoto(id: string): Promise<{ error?: string }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  await removePhotoFile(id);
  return {};
}
