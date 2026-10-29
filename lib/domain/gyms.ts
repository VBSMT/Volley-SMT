/**
 * Gymnases volley34 (https://api.volley34.fr/v1/gymnases) et lien d'itinéraire Google Maps.
 * Le lieu d'un match (flux ICS) est le « NomComplet » du gymnase : « Nom (Ville) ».
 */
export type Gym = {
  code: string;
  name: string;
  fullName: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
};

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().replace(/,$/, "") : null);

/** « 43.56|3.84 » ou « 43,63|3,91 » → coordonnées, sinon null. */
export function parseGps(gps: unknown): { lat: number; lon: number } | null {
  const [lat, lon] = String(gps ?? "").split("|").map((p) => Number(p.trim().replace(",", ".")));
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon)
    ? { lat, lon }
    : null;
}

export function parseGyms(json: string): Gym[] {
  const data = JSON.parse(json) as Record<string, unknown>[];
  if (!Array.isArray(data)) return [];
  return data.flatMap((g) => {
    const code = clean(g.GymnaseCode);
    const name = clean(g.Nom);
    if (!code || !name) return [];
    const gps = parseGps(g.GPS);
    return [
      {
        code,
        name,
        fullName: clean(g.NomComplet) ?? name,
        address: clean(g.Adresse),
        postalCode: clean(g.CP),
        city: clean(g.Ville),
        lat: gps?.lat ?? null,
        lon: gps?.lon ?? null,
      },
    ];
  });
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Retrouve le gymnase d'un match à partir de son lieu (salle + ville). */
export function findGym(venue: string | null, city: string | null, gyms: Gym[]): Gym | null {
  if (!venue) return null;
  const full = norm(city ? `${venue} (${city})` : venue);
  const exact = gyms.find((g) => norm(g.fullName) === full);
  if (exact) return exact;
  const sameName = gyms.filter((g) => norm(g.name) === norm(venue));
  if (sameName.length === 1) return sameName[0];
  // Même nom, plusieurs villes (« Salle Polyvalente ») : départager par la ville (parfois abrégée).
  const c = norm(city);
  return (c && sameName.find((g) => norm(g.city).startsWith(c.replace(/ t$/, "")) || norm(g.fullName).includes(c))) || null;
}

/** Lien Google Maps « itinéraire » : coordonnées du gymnase si connues, sinon recherche par nom. */
export function directionsUrl(venue: string | null, city: string | null, gym: Gym | null): string | null {
  const destination =
    gym?.lat != null && gym.lon != null
      ? `${gym.lat},${gym.lon}`
      : gym
        ? [gym.name, gym.address, gym.postalCode, gym.city].filter(Boolean).join(", ")
        : [venue, city].filter(Boolean).join(", ");
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
