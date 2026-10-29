export type ThemeChoice = "auto" | "light" | "dark";

export const THEME_COOKIE = "theme";

/** Valeur de l'attribut data-theme : absente en automatique (le téléphone décide). */
export function themeAttribute(choice: string | undefined): "light" | "dark" | undefined {
  return choice === "light" || choice === "dark" ? choice : undefined;
}
