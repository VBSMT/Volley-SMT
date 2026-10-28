// Types et libellés partagés client/serveur (aucun import serveur ici).

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
