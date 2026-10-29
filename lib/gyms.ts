import "server-only";
import { directionsUrl, findGym, type Gym } from "@/lib/domain/gyms";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Renvoie une fonction (salle, ville) → lien d'itinéraire Google Maps. */
export async function getDirections(client: Client) {
  const { data } = await client.from("gyms").select("code, name, full_name, address, postal_code, city, lat, lon");
  const gyms: Gym[] = (data ?? []).map((g) => ({
    code: g.code,
    name: g.name,
    fullName: g.full_name,
    address: g.address,
    postalCode: g.postal_code,
    city: g.city,
    lat: g.lat,
    lon: g.lon,
  }));
  return (venue: string | null, city: string | null) => directionsUrl(venue, city, findGym(venue, city, gyms));
}
