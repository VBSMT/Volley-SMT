import { describe, expect, it } from "vitest";
import { cropRect, dragCrop, initialCrop } from "./photo-crop";

describe("recadrage de la photo", () => {
  it("carré le plus grand, contenu dans l'image", () => {
    expect(cropRect(1000, 2000, { cx: 500, cy: 0, zoom: 1 })).toMatchObject({ x: 0, y: 0, side: 1000 });
    expect(cropRect(1000, 2000, { cx: 500, cy: 5000, zoom: 1 })).toMatchObject({ y: 1000 });
  });
  it("le zoom réduit le carré, borné de 1 à 4", () => {
    expect(cropRect(1000, 1000, { cx: 500, cy: 500, zoom: 2 }).side).toBe(500);
    expect(cropRect(1000, 1000, { cx: 500, cy: 500, zoom: 9 }).side).toBe(250);
    expect(cropRect(1000, 1000, { cx: 500, cy: 500, zoom: 0.5 }).side).toBe(1000);
  });
  it("glisser vers le bas remonte le cadre", () => {
    const c = dragCrop(1000, 2000, { cx: 500, cy: 1000, zoom: 1 }, 0, 100, 250);
    expect(c.cy).toBe(600); // 100 px à l'écran = 400 px de l'image (1000 / 250)
  });
  it("départ d'une photo en hauteur : un peu au-dessus du centre", () => {
    expect(initialCrop(1000, 2000).cy).toBe(840);
    expect(initialCrop(2000, 1000)).toEqual({ cx: 1000, cy: 500, zoom: 1 });
  });
});
