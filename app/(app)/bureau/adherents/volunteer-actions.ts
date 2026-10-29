"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCurrentMember, hasRole } from "@/lib/member";
import { notifyMembers } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Le Bureau valide (rôle bénévole ajouté) ou refuse une demande « Devenir bénévole ». */
export async function decideVolunteerRequest(requestId: string, approve: boolean): Promise<{ error?: string }> {
  const me = await getCurrentMember();
  if (!hasRole(me, "board")) return { error: "Réservé au Bureau." };

  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("volunteer_requests")
    .update({ status: approve ? "approved" : "rejected", decided_by: me!.id, decided_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("member_id")
    .maybeSingle();
  if (error || !request) return { error: "Demande déjà traitée ou introuvable." };

  if (approve) {
    const { error: roleError } = await supabase
      .from("member_roles")
      .insert({ member_id: request.member_id, role: "volunteer" });
    if (roleError && roleError.code !== "23505") return { error: "Rôle bénévole non ajouté." };
  }

  after(async () => {
    const { data: member } = await createAdminClient()
      .from("members")
      .select("id, email, first_name")
      .eq("id", request.member_id)
      .single();
    if (!member) return;
    await notifyMembers([
      {
        recipient: member,
        message: approve
          ? { title: "Bienvenue chez les bénévoles !", body: "Ta demande a été validée par le Bureau. Merci !", url: "/profil" }
          : { title: "Demande de bénévolat", body: "Le Bureau n'a pas retenu ta demande pour le moment.", url: "/profil" },
      },
    ]);
  });

  revalidatePath("/", "layout");
  return {};
}
