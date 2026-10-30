import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Photo d'un joueur (jeu de cartes, fiches équipes) : adhérents connectés seulement, et seulement si le
 * joueur a donné son droit à l'image (vues `game_cards` et `team_roster`, RLS) ; sa propre photo et, pour le Bureau, toutes. Mise en cache privée : l'adresse change avec la photo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const supabase = await createClient();
  const { data: card } = await supabase.from("game_cards").select("photo_updated_at").eq("member_id", id).not("photo_updated_at", "is", null).limit(1).maybeSingle();
  // Fiches équipes (tout adhérent, droit à l'image vérifié par la vue `team_roster`).
  const roster = card
    ? null
    : (await supabase.from("team_roster").select("photo_updated_at").eq("member_id", id).not("photo_updated_at", "is", null).limit(1).maybeSingle()).data;
  // Sa propre photo (profil) et toutes pour le Bureau (modération) : fiches lisibles via la RLS.
  const own = card || roster ? null : (await supabase.from("members").select("photo_updated_at").eq("id", id).maybeSingle()).data;
  if (!card && !roster && !own?.photo_updated_at) return new Response(null, { status: 404 });

  const { data: file } = await createAdminClient().storage.from("photos").download(`${id}.webp`);
  if (!file) return new Response(null, { status: 404 });
  return new Response(file, {
    headers: { "Content-Type": file.type || "image/webp", "Cache-Control": "private, max-age=2592000, immutable" },
  });
}
