"use client";

import { useState } from "react";
import { THEME_COOKIE, themeAttribute, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "auto", label: "Automatique (selon le téléphone)" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];

/** Choix du thème, mémorisé sur cet appareil (cookie lu par le serveur : pas de flash). */
export function ThemeChooser({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  const apply = (value: ThemeChoice) => {
    setChoice(value);
    document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    const attr = themeAttribute(value);
    if (attr) document.documentElement.dataset.theme = attr;
    else delete document.documentElement.dataset.theme;
  };

  return (
    <fieldset className="stack">
      <legend>Thème</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className="checkbox">
          <input type="radio" name="theme" value={o.value} checked={choice === o.value} onChange={() => apply(o.value)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
