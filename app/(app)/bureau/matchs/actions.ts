"use server";

import { revalidatePath } from "next/cache";
import { readSheet } from "read-excel-file/node";
import { parseMatchSheet } from "@/lib/domain/match-import";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

export type ImportState = {
  status: "idle" | "done" | "error";
  errors?: string[];
  summary?: { created: number; updated: number; moved: number; teamsCreated: string[]; missing: number };
};

const MAX_SIZE = 2 * 1024 * 1024;

export async function importMatches(_prev: ImportState, formData: FormData): Promise<ImportState> {
  if (!hasRole(await getCurrentMember(), "board")) {
    return { status: "error", errors: ["Réservé au Bureau."] };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", errors: ["Choisissez un fichier Excel (.xlsx)."] };
  }
  if (file.size > MAX_SIZE) return { status: "error", errors: ["Fichier trop volumineux (2 Mo max)."] };

  let rows: unknown[][];
  try {
    rows = (await readSheet(Buffer.from(await file.arrayBuffer()))) as unknown[][];
  } catch {
    return { status: "error", errors: ["Fichier illisible : est-ce bien un fichier Excel .xlsx ?"] };
  }

  const { matches, errors } = parseMatchSheet(rows);
  // Tout ou rien : on n'importe pas un fichier partiellement faux.
  if (errors.length) return { status: "error", errors };

  const supabase = await createClient();

  // Équipes : création de celles qui n'existent pas encore.
  const { data: teams, error: teamsError } = await supabase.from("teams").select("id, name");
  if (teamsError) return { status: "error", errors: ["Lecture des équipes impossible."] };
  const teamIds = new Map(teams.map((t) => [t.name, t.id as string]));
  const newTeams = [...new Set(matches.map((m) => m.teamName))].filter((n) => !teamIds.has(n));
  if (newTeams.length) {
    const { data, error } = await supabase
      .from("teams")
      .insert(newTeams.map((name) => ({ name })))
      .select("id, name");
    if (error) return { status: "error", errors: ["Création des équipes impossible."] };
    data.forEach((t) => teamIds.set(t.name, t.id));
  }

  // Comparaison avec l'existant pour le compte rendu.
  const { data: existing, error: existingError } = await supabase
    .from("matches")
    .select("team_id, competition, phase, round, starts_at");
  if (existingError) return { status: "error", errors: ["Lecture des matchs impossible."] };
  const keyOf = (m: { team_id: string; competition: string; phase: string | null; round: number | null }) =>
    `${m.team_id}|${m.competition}|${m.phase}|${m.round}`;
  const before = new Map(existing.map((m) => [keyOf(m), new Date(m.starts_at).getTime()]));

  const rowsToSave = matches.map((m) => ({
    team_id: teamIds.get(m.teamName)!,
    competition: m.competition,
    division: m.division,
    phase: m.phase,
    round: m.round,
    is_home: m.isHome,
    opponent: m.opponent,
    venue: m.venue,
    city: m.city,
    starts_at: m.startsAt,
    source: "excel" as const,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("matches")
    .upsert(rowsToSave, { onConflict: "team_id,competition,phase,round" });
  if (upsertError) return { status: "error", errors: ["Enregistrement des matchs impossible."] };

  const fileKeys = new Set(rowsToSave.map(keyOf));
  const summary = {
    created: rowsToSave.filter((r) => !before.has(keyOf(r))).length,
    updated: rowsToSave.filter((r) => before.has(keyOf(r))).length,
    moved: rowsToSave.filter((r) => {
      const t = before.get(keyOf(r));
      return t !== undefined && t !== new Date(r.starts_at).getTime();
    }).length,
    teamsCreated: newTeams,
    missing: [...before.keys()].filter((k) => !fileKeys.has(k)).length,
  };

  await supabase.from("sync_runs").insert({
    source: "excel",
    finished_at: new Date().toISOString(),
    success: true,
    message: `${summary.created} créés, ${summary.updated} mis à jour`,
  });

  revalidatePath("/matchs");
  return { status: "done", summary };
}
