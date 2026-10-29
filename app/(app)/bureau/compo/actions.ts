"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, hasRole } from "@/lib/member";
import { generateLineup } from "@/lib/lineup-server";
import { createClient } from "@/lib/supabase/server";
import { getSessions } from "@/lib/training";

/** (Re)génère la compo d'une séance avec les réponses actuelles du sondage. */
export async function regenerateLineup(sessionId: string): Promise<{ error?: string }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  const supabase = await createClient();
  const { data: s } = await supabase.from("training_sessions").select("starts_at").eq("id", sessionId).maybeSingle();
  if (!s) return { error: "Séance introuvable." };
  const [session] = await getSessions({ from: new Date(new Date(s.starts_at).getTime() - 1000), limit: 1 });
  if (!session || session.id !== sessionId) return { error: "Séance introuvable." };
  try {
    await generateLineup(supabase, session);
  } catch (e) {
    return { error: `Génération impossible : ${(e as Error).message}` };
  }
  revalidatePath("/bureau/compo");
  return {};
}
