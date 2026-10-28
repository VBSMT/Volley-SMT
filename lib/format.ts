const TZ = "Europe/Paris";

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export const formatMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { timeZone: TZ, month: "long", year: "numeric" });
