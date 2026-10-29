"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, hasRole } from "@/lib/member";
import { generateLineup, saveManualLineup } from "@/lib/lineup-server";
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

/**
 * Bureau : ajoute (present = true), retire (false) ou efface (null) manuellement la réponse d'un adhérent,
 * par ex. venu sans avoir répondu. La compo déjà calculée est recalculée.
 */
export async function setAttendance(sessionId: string, memberId: string, present: boolean | null): Promise<{ error?: string }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  const supabase = await createClient();
  const { error } =
    present === null
      ? await supabase.from("attendance").delete().match({ session_id: sessionId, member_id: memberId })
      : await supabase
          .from("attendance")
          .upsert(
            { session_id: sessionId, member_id: memberId, present, answered_at: new Date().toISOString() },
            { onConflict: "session_id,member_id" },
          );
  if (error) return { error: "Modification non enregistrée." };

  const { data: lineup } = await supabase.from("lineups").select("session_id").eq("session_id", sessionId).maybeSingle();
  if (lineup) await regenerateLineup(sessionId);
  revalidatePath("/", "layout");
  return {};
}

/** Bureau : déplacement de joueurs entre équipes (glisser-déposer). */
export async function moveLineupPlayers(sessionId: string, teams: string[][]): Promise<{ error?: string }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  try {
    await saveManualLineup(await createClient(), sessionId, teams);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/bureau/compo");
  return {};
}
