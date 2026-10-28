"use server";

import { revalidatePath } from "next/cache";
import { generateSessions } from "@/lib/domain/training";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

export type SeasonState = { status: "idle" | "done" | "error"; message?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireBoard() {
  return hasRole(await getCurrentMember(), "board");
}

/** Crée la saison et ses séances. Relançable : les séances existantes ne sont pas modifiées. */
export async function createSeason(_prev: SeasonState, formData: FormData): Promise<SeasonState> {
  if (!(await requireBoard())) return { status: "error", message: "Réservé au Bureau." };

  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from >= to) {
    return { status: "error", message: "Dates de saison invalides." };
  }
  const label = `${from.slice(0, 4)}-${to.slice(0, 4)}`;

  const supabase = await createClient();
  const { data: season, error } = await supabase
    .from("seasons")
    .upsert({ label, starts_on: from, ends_on: to }, { onConflict: "label" })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Création de la saison impossible." };

  const sessions = generateSessions(from, to).map((s) => ({
    season_id: season.id,
    starts_at: s.startsAt,
    ends_at: s.endsAt,
    is_closed_day: s.isClosedDay,
    open_courts: s.openCourts,
  }));
  const { error: sessionsError } = await supabase
    .from("training_sessions")
    .upsert(sessions, { onConflict: "starts_at", ignoreDuplicates: true });
  if (sessionsError) return { status: "error", message: "Création des séances impossible." };

  revalidatePath("/", "layout");
  const closed = sessions.filter((s) => s.open_courts === 0).length;
  return {
    status: "done",
    message: `Saison ${label} : ${sessions.length} séances, dont ${closed} fermées (vacances et jours fériés).`,
  };
}

export async function setOpenCourts(sessionId: string, courts: number): Promise<{ error?: string }> {
  if (!(await requireBoard())) return { error: "Réservé au Bureau." };
  if (![0, 1, 2, 3].includes(courts)) return { error: "Nombre de terrains invalide." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("training_sessions")
    .update({ open_courts: courts })
    .eq("id", sessionId);
  if (error) return { error: "Modification impossible." };
  revalidatePath("/", "layout");
  return {};
}
