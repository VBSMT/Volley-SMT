/**
 * Recadrage de la photo du profil (fonction pure) : un carré pris dans l'image d'origine,
 * centré sur (cx, cy), de côté min(largeur, hauteur) / zoom, toujours contenu dans l'image.
 */
export type Crop = { cx: number; cy: number; zoom: number };
export const MAX_ZOOM = 4;

export function cropRect(w: number, h: number, crop: Crop) {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, crop.zoom));
  const side = Math.min(w, h) / zoom;
  const clamp = (v: number, max: number) => Math.min(max - side / 2, Math.max(side / 2, v));
  const cx = clamp(crop.cx, w);
  const cy = clamp(crop.cy, h);
  return { x: cx - side / 2, y: cy - side / 2, side, crop: { cx, cy, zoom } };
}

/** Déplace le cadre d'un glissé de (dx, dy) pixels à l'écran, pour un cadre affiché sur `view` pixels. */
export function dragCrop(w: number, h: number, crop: Crop, dx: number, dy: number, view: number): Crop {
  const { side } = cropRect(w, h, crop);
  // Glisser la photo vers la droite montre ce qui est à gauche : le centre recule.
  return cropRect(w, h, { ...crop, cx: crop.cx - (dx * side) / view, cy: crop.cy - (dy * side) / view }).crop;
}

/** Cadrage de départ : carré le plus grand, un peu au-dessus du centre pour une photo en hauteur (visage). */
export function initialCrop(w: number, h: number): Crop {
  return cropRect(w, h, { cx: w / 2, cy: h > w ? h * 0.42 : h / 2, zoom: 1 }).crop;
}
