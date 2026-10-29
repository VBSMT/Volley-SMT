"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

export async function saveLink(id: string | null, label: string, url: string): Promise<{ error?: string }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  const cleanLabel = label.trim().slice(0, 80);
  const cleanUrl = url.trim();
  if (!cleanLabel) return { error: "Libellé obligatoire." };
  if (!/^https?:\/\/\S+$/i.test(cleanUrl)) return { error: "Adresse invalide (http:// ou https://)." };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("useful_links").update({ label: cleanLabel, url: cleanUrl }).eq("id", id)
    : await supabase.from("useful_links").insert({ label: cleanLabel, url: cleanUrl, position: Date.now() % 32000 });
  if (error) return { error: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteLink(id: string): Promise<{ error?: string }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  const { error } = await (await createClient()).from("useful_links").delete().eq("id", id);
  if (error) return { error: "Suppression impossible." };
  revalidatePath("/", "layout");
  return {};
}
