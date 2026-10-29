"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { canSeeEvent, type EventType, type Role } from "@/lib/domain/events";
import { eventMessage } from "@/lib/domain/notifications";
import { parisWallTimeToUtc } from "@/lib/domain/paris-time";
import { getCurrentMember, hasRole } from "@/lib/member";
import { notifyMembers } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EventFormState = { status: "idle" | "error"; message?: string };

const TYPES: EventType[] = ["tournament", "town_event", "members_meal", "other"];
const ROLES: Role[] = ["captain", "volunteer", "board"];

/** Création (eventId null) ou modification d'un événement par le Bureau. */
export async function saveEvent(eventId: string | null, _prev: EventFormState, fd: FormData): Promise<EventFormState> {
  if (!hasRole(await getCurrentMember(), "board")) return { status: "error", message: "Réservé au Bureau." };
  const me = (await getCurrentMember())!;

  const type = String(fd.get("type") ?? "") as EventType;
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const date = String(fd.get("date") ?? "");
  const time = String(fd.get("time") ?? "");
  if (!TYPES.includes(type) || !title) return { status: "error", message: "Type et titre sont obligatoires." };
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return { status: "error", message: "Date et heure invalides." };
  const startsAt = parisWallTimeToUtc(+d[1], +d[2], +d[3], +t[1], +t[2]).toISOString();

  const visibleRoles = fd.get("visibility") === "roles" ? fd.getAll("roles").map(String).filter((r) => ROLES.includes(r as Role)) : [];
  if (fd.get("visibility") === "roles" && !visibleRoles.length) {
    return { status: "error", message: "Choisissez au moins un rôle, ou « Tous les adhérents »." };
  }
  const attendancePoll = fd.get("attendance_poll") === "on";
  const volunteerPoll = fd.get("volunteer_poll") === "on";
  const needs = fd
    .getAll("need_label")
    .map((label, i) => ({ label: String(label).trim().slice(0, 40), needed: Number(fd.getAll("need_count")[i]) }))
    .filter((n) => n.label && Number.isInteger(n.needed) && n.needed > 0);

  const row = {
    type,
    title,
    starts_at: startsAt,
    location: String(fd.get("location") ?? "").trim().slice(0, 120) || null,
    description: String(fd.get("description") ?? "").trim().slice(0, 4000) || null,
    visible_roles: visibleRoles,
    attendance_poll: attendancePoll,
    ask_partner: attendancePoll && fd.get("ask_partner") === "on",
    ask_children: attendancePoll && fd.get("ask_children") === "on",
    ask_guests: attendancePoll && fd.get("ask_guests") === "on",
    volunteer_poll: volunteerPoll,
  };

  const supabase = await createClient();
  const { data: saved, error } = eventId
    ? await supabase.from("events").update(row).eq("id", eventId).select("id").single()
    : await supabase.from("events").insert({ ...row, created_by: me.id }).select("id").single();
  if (error) return { status: "error", message: "Événement non enregistré." };

  // Besoins bénévoles : mis à jour par libellé (les inscriptions existantes sont conservées).
  const { data: existing } = await supabase.from("event_volunteer_needs").select("id, label").eq("event_id", saved.id);
  const keep = new Set(needs.map((n) => n.label.toLowerCase()));
  const toDelete = (existing ?? []).filter((n) => !volunteerPoll || !keep.has(n.label.toLowerCase())).map((n) => n.id);
  if (toDelete.length) await supabase.from("event_volunteer_needs").delete().in("id", toDelete);
  if (volunteerPoll && needs.length) {
    await supabase
      .from("event_volunteer_needs")
      .upsert(needs.map((n) => ({ event_id: saved.id, label: n.label, needed: n.needed })), { onConflict: "event_id,label" });
  }

  if (!eventId && fd.get("notify") === "on") {
    after(async () => {
      const { data: members } = await createAdminClient()
        .from("members")
        .select("id, email, first_name, roles:member_roles(role)")
        .not("user_id", "is", null);
      const message = eventMessage({ id: saved.id, title, startsAt, location: row.location });
      const audience = (members ?? []).filter((m) =>
        canSeeEvent(visibleRoles as Role[], (m.roles as { role: Role }[]).map((r) => r.role)),
      );
      await notifyMembers(audience.map(({ id, email, first_name }) => ({ recipient: { id, email, first_name }, message })));
    });
  }

  revalidatePath("/", "layout");
  redirect(`/evenements/${saved.id}`);
}

export async function deleteEvent(eventId: string): Promise<{ error?: string }> {
  if (!hasRole(await getCurrentMember(), "board")) return { error: "Réservé au Bureau." };
  const { error } = await (await createClient()).from("events").delete().eq("id", eventId);
  if (error) return { error: "Suppression impossible." };
  revalidatePath("/", "layout");
  redirect("/bureau/evenements");
}
