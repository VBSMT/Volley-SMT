"use client";

import { useState } from "react";
import { PALETTE_COOKIE, PALETTES, paletteAttribute, type PaletteChoice } from "@/lib/theme";

/** Choix du thème de couleurs, mémorisé sur cet appareil (cookie lu par le serveur : pas de flash). */
export function PaletteChooser({ initial }: { initial: PaletteChoice }) {
  const [choice, setChoice] = useState<PaletteChoice>(initial);

  const apply = (value: PaletteChoice) => {
    setChoice(value);
    document.cookie = `${PALETTE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    const attr = paletteAttribute(value);
    if (attr) document.documentElement.dataset.palette = attr;
    else delete document.documentElement.dataset.palette;
    // Couleur de la barre du téléphone.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", PALETTES.find((p) => p.value === value)!.dark));
  };

  return (
    <fieldset className="stack">
      <legend>Thème de couleurs</legend>
      <div className="palette-grid">
        {PALETTES.map((p) => (
          <label key={p.value} className={`palette-option${choice === p.value ? " is-selected" : ""}`}>
            <input type="radio" name="palette" value={p.value} checked={choice === p.value} onChange={() => apply(p.value)} className="sr-only" />
            <span className="palette-swatch" style={{ background: p.dark, color: p.accent }} aria-hidden="true">
              Aa
            </span>
            {p.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
