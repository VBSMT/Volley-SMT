"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { AnnouncementTarget } from "@/lib/announcements";
import { announcementMessage } from "@/lib/domain/notifications";
import { getCurrentMember, hasRole } from "@/lib/member";
import { notifyMembers, type Recipient } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AnnouncementState = { status: "idle" | "sent" | "error"; message?: string };

const TARGETS: AnnouncementTarget[] = ["club", "team", "volunteers", "session"];

/** Destinataires (comptes actifs) selon la cible de l'annonce. */
async function audience(target: AnnouncementTarget, teamId: string | null, sessionId: string | null): Promise<Recipient[]> {
  const admin = createAdminClient();
  const select = "id, email, first_name";
  const rows =
    target === "club"
      ? (await admin.from("members").select(select).not("user_id", "is", null)).data
      : target === "team"
        ? (await admin.from("members").select(`${select}, member_teams!inner(team_id)`).eq("member_teams.team_id", teamId!).not("user_id", "is", null)).data
        : target === "volunteers"
          ? (await admin.from("members").select(`${select}, member_roles!inner(role)`).eq("member_roles.role", "volunteer").not("user_id", "is", null)).data
          : (await admin
              .from("members")
              .select(`${select}, attendance!inner(session_id, present)`)
              .eq("attendance.session_id", sessionId!)
              .eq("attendance.present", true)
              .not("user_id", "is", null)).data;
  return (rows ?? []).map((m) => ({ id: m.id, email: m.email, first_name: m.first_name }));
}

export async function createAnnouncement(_prev: AnnouncementState, fd: FormData): Promise<AnnouncementState> {
  const me = await getCurrentMember();
  if (!hasRole(me, "board")) return { status: "error", message: "Réservé au Bureau." };

  const target = String(fd.get("target") ?? "") as AnnouncementTarget;
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const body = String(fd.get("body") ?? "").trim().slice(0, 4000);
  const teamId = target === "team" ? String(fd.get("team_id") ?? "") || null : null;
  const sessionId = target === "session" ? String(fd.get("session_id") ?? "") || null : null;
  if (!TARGETS.includes(target)) return { status: "error", message: "Choisissez les destinataires." };
  if (!title || !body) return { status: "error", message: "Titre et message sont obligatoires." };
  if (target === "team" && !teamId) return { status: "error", message: "Choisissez l'équipe." };
  if (target === "session" && !sessionId) return { status: "error", message: "Choisissez la séance." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({ author_id: me!.id, target, team_id: teamId, session_id: sessionId, title, body })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Annonce non enregistrée." };

  const notify = fd.get("notify") === "on";
  if (notify) {
    after(async () => {
      const recipients = await audience(target, teamId, sessionId);
      const message = announcementMessage({ id: data.id, title, body, author: `${me!.first_name} ${me!.last_name}` });
      await notifyMembers(recipients.map((recipient) => ({ recipient, message })));
    });
  }
  revalidatePath("/", "layout");
  return { status: "sent", message: notify ? "Annonce publiée, notifications en cours d'envoi." : "Annonce publiée." };
}

export async function deleteAnnouncement(id: string): Promise<{ error?: string }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { error: "Suppression impossible." };
  revalidatePath("/", "layout");
  return {};
}
