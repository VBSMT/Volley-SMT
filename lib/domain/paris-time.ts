const TIME_ZONE = "Europe/Paris";

/** Décalage (en minutes) de l'heure de Paris par rapport à UTC à l'instant donné. */
function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return (asUtc - at.getTime()) / 60_000;
}

/** Convertit une heure « murale » de Paris (heure d'été/hiver gérée) en instant UTC. */
export function parisWallTimeToUtc(
  year: number,
  month: number, // 1–12
  day: number,
  hour: number,
  minute: number,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = parisOffsetMinutes(new Date(guess.getTime() - parisOffsetMinutes(guess) * 60_000));
  return new Date(guess.getTime() - offset * 60_000);
}
