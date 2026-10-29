"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

const count = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : 0;
};

/** Réponse au sondage de présence d'un événement (avec conjoint·e, enfants, invités si demandés). */
export async function answerEvent(
  eventId: string,
  answer: { coming: boolean; with_partner?: boolean; children?: number; guests?: number },
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_attendance").upsert(
    {
      event_id: eventId,
      member_id: member.id,
      coming: answer.coming,
      with_partner: answer.coming ? !!answer.with_partner : null,
      children: answer.coming ? count(answer.children) : null,
      guests: answer.coming ? count(answer.guests) : null,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "event_id,member_id" },
  );
  if (error) return { error: "Réponse non enregistrée (événement passé ?)." };
  revalidatePath(`/evenements/${eventId}`);
  revalidatePath("/accueil");
  return {};
}

/** Participation bénévole : disponibilité et poste choisi. */
export async function answerVolunteer(eventId: string, available: boolean, needId: string | null): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_volunteer_signups").upsert(
    { event_id: eventId, member_id: member.id, available, need_id: available ? needId : null, answered_at: new Date().toISOString() },
    { onConflict: "event_id,member_id" },
  );
  if (error) return { error: "Réponse non enregistrée." };
  revalidatePath(`/evenements/${eventId}`);
  return {};
}
