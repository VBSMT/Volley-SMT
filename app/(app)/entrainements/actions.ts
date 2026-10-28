"use server";

import { revalidatePath } from "next/cache";
import { pollDeadline } from "@/lib/domain/training";
import { getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

export async function answerPoll(sessionId: string, present: boolean): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("training_sessions")
    .select("starts_at, poll_closed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.poll_closed_at || Date.now() >= pollDeadline(session.starts_at).getTime()) {
    return { error: "Le sondage de cette séance est clos." };
  }

  const { error } = await supabase.from("attendance").upsert(
    { session_id: sessionId, member_id: member.id, present, answered_at: new Date().toISOString() },
    { onConflict: "session_id,member_id" },
  );
  if (error) return { error: "Réponse non enregistrée. Réessayez." };

  revalidatePath("/entrainements");
  revalidatePath("/accueil");
  return {};
}
