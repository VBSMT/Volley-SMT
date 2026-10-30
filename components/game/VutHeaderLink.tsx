"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Événement envoyé à l'ouverture d'un booster : la pastille de l'en-tête suit sans rechargement. */
export const BOOSTER_OPENED = "vut:booster-opened";

/** Lien « VUT » de l'en-tête avec la pastille des boosters à ouvrir. */
export function VutHeaderLink({ count, rulesOnly }: { count: number; rulesOnly: boolean }) {
  const [boosters, setBoosters] = useState(count);
  useEffect(() => setBoosters(count), [count]);
  useEffect(() => {
    const onOpened = () => setBoosters((n) => Math.max(0, n - 1));
    window.addEventListener(BOOSTER_OPENED, onOpened);
    return () => window.removeEventListener(BOOSTER_OPENED, onOpened);
  }, []);
  return (
    <Link
      href={rulesOnly ? "/jeu/regles" : boosters ? "/jeu?vue=boosters" : "/jeu"}
      className="header-game"
      aria-label={boosters ? `VUT, ${boosters} booster${boosters > 1 ? "s" : ""} à ouvrir` : "VUT, Volley Ultimate Team"}
    >
      VUT
      {boosters > 0 && <span className="chat-badge">{boosters}</span>}
    </Link>
  );
}
