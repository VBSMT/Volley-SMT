"use server";

import { revalidatePath } from "next/cache";
import { LIMITS, scheduleToSettings, type Schedule } from "@/lib/domain/settings";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { status: "idle" | "saved" | "error"; message?: string };

const inRange = (v: FormDataEntryValue | null, key: keyof typeof LIMITS) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= LIMITS[key].min && n <= LIMITS[key].max ? n : null;
};

export async function saveSchedule(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  if (!hasRole(await getCurrentMember(), "board")) return { status: "error", message: "Réservé au Bureau." };
  const s = {
    reminderHour: inRange(fd.get("reminderHour"), "reminderHour"),
    closeHour: inRange(fd.get("closeHour"), "closeHour"),
    expiryDays: inRange(fd.get("expiryDays"), "expiryDays"),
  };
  if (s.reminderHour === null || s.closeHour === null || s.expiryDays === null) {
    return { status: "error", message: "Valeurs hors limites." };
  }
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("app_settings")
    .upsert(scheduleToSettings(s as Schedule).map((r) => ({ ...r, updated_at: now })), { onConflict: "key" });
  if (error) return { status: "error", message: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { status: "saved" };
}

/** Renommer ou créer une équipe (la synchro volley34 retrouve ensuite l'équipe par son code). */
export async function saveTeam(teamId: string | null, name: string): Promise<{ error?: string }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!clean) return { error: "Nom obligatoire." };
  const supabase = await createClient();
  const { error } = teamId
    ? await supabase.from("teams").update({ name: clean }).eq("id", teamId)
    : await supabase.from("teams").insert({ name: clean });
  if (error) return { error: error.code === "23505" ? "Une équipe porte déjà ce nom." : "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return {};
}
