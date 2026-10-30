export type ThemeChoice = "auto" | "light" | "dark";

export const THEME_COOKIE = "theme";

/** Valeur de l'attribut data-theme : absente en automatique (le téléphone décide). */
export function themeAttribute(choice: string | undefined): "light" | "dark" | undefined {
  return choice === "light" || choice === "dark" ? choice : undefined;
}

/** Thèmes de couleurs (couleur foncée + accent). « club » : noir / jaune, par défaut. */
export type PaletteChoice = "club" | "ocean" | "bordeaux" | "volcan";
export const PALETTE_COOKIE = "palette";
export const PALETTES: { value: PaletteChoice; label: string; dark: string; accent: string }[] = [
  { value: "club", label: "Club", dark: "#111111", accent: "#ffe81a" },
  { value: "ocean", label: "Océan", dark: "#0b2545", accent: "#3ddcd3" },
  { value: "bordeaux", label: "Bordeaux & or", dark: "#4a0e1f", accent: "#f2c14e" },
  { value: "volcan", label: "Volcan", dark: "#1e1e24", accent: "#ff8a2a" },
];

/** Valeur de l'attribut data-palette : absente pour le thème Club (défaut). */
export function paletteAttribute(choice: string | undefined): Exclude<PaletteChoice, "club"> | undefined {
  return choice === "ocean" || choice === "bordeaux" || choice === "volcan" ? choice : undefined;
}
