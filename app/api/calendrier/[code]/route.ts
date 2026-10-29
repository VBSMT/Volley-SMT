import { NextResponse, type NextRequest } from "next/server";
import { findGym, type Gym } from "@/lib/domain/gyms";
import { buildIcs } from "@/lib/domain/ics";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Flux agenda public des matchs d'une équipe : /api/calendrier/SMDT1.ics
 * Mêmes informations que le calendrier public volley34 (aucune donnée personnelle).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.replace(/\.ics$/i, "").toUpperCase();
  if (!/^[A-Z0-9]{2,20}$/.test(code)) return new NextResponse("Équipe inconnue", { status: 404 });

  const admin = createAdminClient();
  const { data: team } = await admin.from("teams").select("id, name").eq("volley34_ref", code).maybeSingle();
  if (!team) return new NextResponse("Équipe inconnue", { status: 404 });

  const [{ data: matches }, { data: gymRows }] = await Promise.all([
    admin
      .from("matches")
      .select("id, volley34_ref, starts_at, opponent, is_home, competition, division, venue, city")
      .eq("team_id", team.id)
      .gte("starts_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
      .order("starts_at"),
    admin.from("gyms").select("code, name, full_name, address, postal_code, city, lat, lon"),
  ]);
  const gyms: Gym[] = (gymRows ?? []).map((g) => ({
    code: g.code,
    name: g.name,
    fullName: g.full_name,
    address: g.address,
    postalCode: g.postal_code,
    city: g.city,
    lat: g.lat,
    lon: g.lon,
  }));

  const origin = request.nextUrl.origin;
  const body = buildIcs(
    team.name,
    (matches ?? []).map((m) => {
      const gym = findGym(m.venue, m.city, gyms);
      const location = gym
        ? [gym.name, gym.address, [gym.postalCode, gym.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
        : [m.venue, m.city].filter(Boolean).join(", ") || null;
      return {
        id: m.id,
        uid: m.volley34_ref,
        startsAt: m.starts_at,
        opponent: m.opponent,
        isHome: m.is_home,
        competition: [m.competition, m.division].filter(Boolean).join(" · ") || null,
        location,
        url: `${origin}/matchs/${m.id}`,
      };
    }),
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="volley-smt-${code.toLowerCase()}.ics"`,
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
}
