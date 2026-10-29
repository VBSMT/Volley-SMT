"use server";

import { getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

/** Guide de première connexion : enregistre l'étape suivante, ou la fin (terminé ou passé). */
export async function saveOnboarding(step: number, done: boolean): Promise<void> {
  const member = await getCurrentMember();
  if (!member) return;
  const supabase = await createClient();
  await supabase
    .from("members")
    .update({ onboarding_step: Math.max(0, Math.min(99, Math.round(step))), onboarding_done_at: done ? new Date().toISOString() : null })
    .eq("id", member.id);
}
