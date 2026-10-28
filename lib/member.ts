import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

import type { CurrentMember, Role } from "./member-types";

export * from "./member-types";

/** Fiche de l'adhérent connecté (RLS : il ne lit que la sienne). Mise en cache par requête. */
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("members")
    .select(
      `id, first_name, last_name, email, sex, phone, emergency_contact_name,
       emergency_contact_phone, image_consent, position_1, position_2, fsgt_license, dues_paid,
       team:teams(name), license_season:seasons(label),
       roles:member_roles(role, team:teams(name))`,
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data as CurrentMember | null;
});

export function hasRole(member: CurrentMember | null, role: Role) {
  return !!member?.roles.some((r) => r.role === role);
}
