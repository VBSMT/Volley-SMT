import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "member" | "captain" | "volunteer" | "board";
export type Position = "setter" | "front" | "back";

export const POSITION_LABELS: Record<Position, string> = {
  setter: "Passe",
  front: "Avant",
  back: "Fond",
};

export const ROLE_LABELS: Record<Role, string> = {
  member: "Adhérent",
  captain: "Capitaine",
  volunteer: "Bénévole",
  board: "Bureau",
};

export type CurrentMember = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  sex: "F" | "M";
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  image_consent: boolean;
  position_1: Position | null;
  position_2: Position | null;
  fsgt_license: string | null;
  dues_paid: boolean;
  team: { name: string } | null;
  license_season: { label: string } | null;
  roles: { role: Role; team: { name: string } | null }[];
};

/** Fiche de l'adhérent connecté (RLS : il ne lit que la sienne). Mise en cache par requête. */
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("members")
    .select(
      `id, first_name, last_name, email, sex, phone, emergency_contact_name,
       emergency_contact_phone, image_consent, position_1, position_2, fsgt_license, dues_paid,
       team:teams(name), license_season:seasons(label),
       roles:member_roles(role, team:teams(name))`,
    )
    .eq("user_id", user.id)
    .maybeSingle();
  return data as CurrentMember | null;
});

export function hasRole(member: CurrentMember | null, role: Role) {
  return !!member?.roles.some((r) => r.role === role);
}
