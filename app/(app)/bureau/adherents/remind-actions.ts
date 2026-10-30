"use server";

import { after } from "next/server";
import { setupStatus } from "@/lib/domain/setup-status";
import { getCurrentMember, hasRole } from "@/lib/member";
import { sendInvitation } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Relance par email les adhérents qui ne se sont jamais connectés (compte créé si besoin).
 * Les emails partent après la réponse, un par un (SMTP Brevo).
 */
export async function remindNotConnected(): Promise<{ error?: string; count?: number }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  const admin = createAdminClient();
  const [{ data: members }, { data: users }] = await Promise.all([
    admin.from("members").select("id, email, first_name, user_id, onboarding_done_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const lastSignIn = new Map((users?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
  const byEmail = new Map((users?.users ?? []).map((u) => [String(u.email).toLowerCase(), u.id]));

  const targets = (members ?? []).filter((m) => {
    const s = setupStatus({
      hasAccount: !!m.user_id,
      lastSignInAt: m.user_id ? (lastSignIn.get(m.user_id) ?? null) : null,
      onboardingDoneAt: m.onboarding_done_at,
    });
    return s === "never" || s === "no_account";
  });
  if (!targets.length) return { count: 0 };

  after(async () => {
    for (const m of targets) {
      try {
        // Sans compte : on le crée (l'inscription libre est désactivée), puis on le rattache à la fiche.
        if (!m.user_id) {
          let userId = byEmail.get(String(m.email).toLowerCase()) ?? null;
          if (!userId) {
            const { data, error } = await admin.auth.admin.createUser({ email: m.email, email_confirm: true });
            if (error) throw error;
            userId = data.user.id;
          }
          await admin.from("members").update({ user_id: userId }).eq("id", m.id).is("user_id", null);
        }
        await sendInvitation({ id: m.id, email: m.email, first_name: m.first_name }, { reminder: true });
      } catch (e) {
        console.error("Relance non envoyée", m.email, (e as Error).message);
      }
    }
  });
  return { count: targets.length };
}
