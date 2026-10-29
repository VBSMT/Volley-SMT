"use server";

import { isAllowedPushEndpoint } from "@/lib/domain/push";
import { getCurrentMember } from "@/lib/member";
import { createAdminClient } from "@/lib/supabase/admin";

type PushSubscriptionJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/**
 * Enregistre l'abonnement push de l'appareil pour l'adhérent connecté.
 * Clé service_role : un appareil déjà abonné par un autre compte est réattribué.
 */
export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "Session expirée. Reconnectez-vous." };
  const { endpoint, keys } = sub;
  if (!isAllowedPushEndpoint(endpoint) || !keys?.p256dh || !keys?.auth) {
    return { error: "Abonnement invalide." };
  }

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      { member_id: member.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: "endpoint" },
    );
  return error ? { error: "Activation impossible. Réessayez." } : {};
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const member = await getCurrentMember();
  if (!member) return;
  await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .match({ endpoint, member_id: member.id });
}
