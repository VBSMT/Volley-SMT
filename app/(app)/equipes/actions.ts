"use server";

import { revalidatePath } from "next/cache";
import type { Position } from "@/lib/member-types";
import { getCurrentMember } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

const POSITIONS: Position[] = ["setter", "front", "front_right", "front_left", "back"];
const valid = (p: string | null) => (p && POSITIONS.includes(p as Position) ? (p as Position) : null);

/** Capitaine (joueurs de son équipe) ou Bureau (tous) : modifie les postes 1 et 2 d'un joueur. Droits vérifiés en base. */
export async function setPlayerPositions(memberId: string, p1: string | null, p2: string | null): Promise<{ error?: string }> {
  if (!(await getCurrentMember())) return { error: "Session expirée. Reconnectez-vous." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_positions", { target: memberId, p1: valid(p1), p2: valid(p2) });
  if (error) return { error: error.code === "42501" ? "Réservé au capitaine de l'équipe ou au Bureau." : "Postes non enregistrés." };
  revalidatePath("/", "layout");
  return {};
}
