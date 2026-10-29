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
      // « * » : sa propre fiche (RLS), robuste aux colonnes ajoutées par une migration pas encore appliquée.
      `*, team:teams(name), license_season:seasons(label),
       roles:member_roles(role, team_id, team:teams(name))`,
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data as CurrentMember | null;
});

export function hasRole(member: CurrentMember | null, role: Role) {
  return !!member?.roles.some((r) => r.role === role);
}

/** Équipes dont l'adhérent est capitaine. */
export function captainTeamIds(member: CurrentMember | null): string[] {
  return (member?.roles ?? []).filter((r) => r.role === "captain" && r.team_id).map((r) => r.team_id!);
}
