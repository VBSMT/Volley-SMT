// Types et libellés partagés client/serveur (aucun import serveur ici).

export type Role = "member" | "captain" | "volunteer" | "board";
/** « front » : avant sans côté précisé (ancien choix, et poste des demandes de renfort). */
export type Position = "setter" | "front" | "front_right" | "front_left" | "back";

export const POSITION_LABELS: Record<Position, string> = {
  setter: "Passe",
  front: "Avant",
  front_right: "Avant (2)",
  front_left: "Avant (4)",
  back: "Fond",
};

/** Postes proposés aux joueurs : Avant (2) à droite au filet, Avant (4) à gauche. */
export const PLAYER_POSITIONS: Position[] = ["setter", "front_right", "front_left", "back"];
/** Postes d'une demande de renfort (avant sans côté). */
export const REINFORCEMENT_POSITIONS: Position[] = ["setter", "front", "back"];

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
  /** Équipes de l'adhérent (0, 1 ou plusieurs). */
  teams: { id: string; name: string }[];
  license_season: { label: string } | null;
  roles: { role: Role; team_id: string | null; team: { name: string } | null }[];
  // Préférences de notification (absentes tant que la migration n'est pas appliquée).
  notify_training?: boolean;
  notify_match?: boolean;
  notify_reinforcement?: boolean;
};

export type NotificationPref = "notify_training" | "notify_match" | "notify_reinforcement";

export const NOTIFICATION_PREFS: { key: NotificationPref; label: string }[] = [
  { key: "notify_training", label: "Entraînements (la veille : demande ou rappel)" },
  { key: "notify_match", label: "Matchs de mon équipe (2 jours avant)" },
  { key: "notify_reinforcement", label: "Demandes de renfort des autres équipes" },
];
