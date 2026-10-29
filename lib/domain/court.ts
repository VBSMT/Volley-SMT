/**
 * Placement des joueurs d'une équipe sur un demi-terrain (fiche équipe). Fonction pure.
 * Poste 1 : passe au filet au centre, avants au filet à gauche et à droite, fond au fond.
 * Plusieurs joueurs au même poste sont superposés ; sans poste : place tirée au hasard.
 */
export type Slot = "passe" | "avantG" | "avantD" | "fond";
export type CourtPlayer = { id: string; position1: "setter" | "front" | "front_right" | "front_left" | "back" | null };

/** Coordonnées en % du terrain (filet en haut). */
export const SLOT_XY: Record<Slot, { x: number; y: number }> = {
  passe: { x: 50, y: 18 },
  avantG: { x: 19, y: 26 },
  avantD: { x: 81, y: 25 },
  fond: { x: 49, y: 70 },
};

const SLOTS: Slot[] = ["passe", "avantG", "avantD", "fond"];

export function placeOnCourt<P extends CourtPlayer>(players: P[], rng: () => number = Math.random): Record<Slot, P[]> {
  const out: Record<Slot, P[]> = { passe: [], avantG: [], avantD: [], fond: [] };
  for (const p of players) {
    if (p.position1 === "setter") out.passe.push(p);
    else if (p.position1 === "back") out.fond.push(p);
    else if (p.position1 === "front_right") out.avantD.push(p); // Avant (2) : à droite au filet
    else if (p.position1 === "front_left") out.avantG.push(p); // Avant (4) : à gauche au filet
  }
  // Avants sans côté précisé : répartis à gauche / à droite.
  for (const p of players) {
    if (p.position1 === "front") (out.avantG.length <= out.avantD.length ? out.avantG : out.avantD).push(p);
  }
  for (const p of players.filter((x) => !x.position1)) out[SLOTS[Math.floor(rng() * SLOTS.length) % SLOTS.length]].push(p);
  return out;
}
