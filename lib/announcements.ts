import type { SupabaseClient } from "@supabase/supabase-js";

export type AnnouncementTarget = "club" | "team" | "volunteers" | "session";

export type AnnouncementView = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  author: string | null;
  target: AnnouncementTarget;
  audience: string; // ex. « Tout le club », « Les St Loup »
};

/** Annonces visibles par l'utilisateur (RLS : destinataires, Bureau voit tout). */
export async function getAnnouncements(client: SupabaseClient, opts: { limit?: number; since?: Date } = {}): Promise<AnnouncementView[]> {
  let q = client
    .from("announcements")
    .select("id, title, body, created_at, author_id, target, team:teams(name), session:training_sessions(starts_at)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.since) q = q.gte("created_at", opts.since.toISOString());
  const { data, error } = await q;
  if (error || !data?.length) return [];

  // Nom de l'auteur via l'annuaire (la fiche complète n'est pas lisible par les adhérents).
  const authorIds = [...new Set(data.map((a) => a.author_id).filter(Boolean))] as string[];
  const { data: authors } = await client.from("member_directory").select("id, first_name, last_name").in("id", authorIds);
  const names = new Map((authors ?? []).map((m) => [m.id as string, `${m.first_name} ${m.last_name}`]));
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short" });

  return data.map((a) => {
    const team = a.team as unknown as { name: string } | null;
    const session = a.session as unknown as { starts_at: string } | null;
    const audience = {
      club: "Tout le club",
      team: team?.name ?? "Équipe",
      volunteers: "Bénévoles",
      session: session ? `Inscrits du ${day(session.starts_at)}` : "Inscrits d'une séance",
    }[a.target as AnnouncementTarget];
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.created_at,
      author: a.author_id ? (names.get(a.author_id) ?? null) : null,
      target: a.target,
      audience,
    };
  });
}
