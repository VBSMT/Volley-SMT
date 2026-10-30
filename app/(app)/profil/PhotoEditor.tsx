"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { PlayerCard } from "@/components/game/PlayerCard";
import type { GameCard } from "@/lib/domain/game";
import { type Crop, MAX_ZOOM, cropRect, dragCrop, initialCrop } from "@/lib/domain/photo-crop";
import { deletePhoto, uploadPhoto } from "./photo-actions";

const SIZE = 320;
/** Taille du cadre de recadrage à l'écran (px). */
const VIEW = 200;

type Source = { bitmap: ImageBitmap; crop: Crop };

/** Dessine le carré choisi de la photo dans un canevas de `size` pixels. */
function draw(canvas: HTMLCanvasElement, { bitmap, crop }: Source, size: number) {
  const { x, y, side } = cropRect(bitmap.width, bitmap.height, crop);
  canvas.width = canvas.height = size;
  canvas.getContext("2d")!.drawImage(bitmap, x, y, side, side, 0, 0, size, size);
}

/** Carré de 320 px compressé (WebP, sinon JPEG ; ≈ 20 à 40 Ko), produit dans le navigateur. */
async function toSquareImage(source: Source): Promise<Blob> {
  const canvas = document.createElement("canvas");
  draw(canvas, source, SIZE);
  const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  // Safari (iPhone) ne sait pas produire de WebP et renvoie du PNG : JPEG à la place, bien plus léger.
  const webp = await encode("image/webp", 0.8);
  const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg", 0.85);
  if (!blob) throw new Error("encodage");
  return blob;
}

/** Photo des cartes du jeu : ajout, remplacement, suppression (droit à l'image requis). */
export function PhotoEditor({ memberId, consent, version, card }: { memberId: string; consent: boolean; version: string | null; card: GameCard }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [thumb, setThumb] = useState<string>();
  const view = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // Cadre redessiné à chaque changement ; aperçu de la carte mis à jour en même temps (image légère).
  useEffect(() => {
    if (!source || !view.current) return;
    draw(view.current, source, VIEW * 2);
    setThumb(view.current.toDataURL("image/jpeg", 0.7));
  }, [source]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!consent) {
    return <p className="small">Pour mettre ta photo sur tes cartes VUT, coche le droit à l&apos;image puis enregistre.</p>;
  }

  async function choose(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      setSource({ bitmap, crop: initialCrop(bitmap.width, bitmap.height) });
    } catch {
      setError("Cette image ne peut pas être lue. Essaie une autre photo.");
    }
    if (input.current) input.current.value = "";
  }

  const setCrop = (f: (c: Crop, w: number, h: number) => Crop) =>
    setSource((s) => (s ? { ...s, crop: f(s.crop, s.bitmap.width, s.bitmap.height) } : s));

  // Glisser à un doigt (ou à la souris) déplace la photo ; pincer à deux doigts zoome.
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && source) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: source.crop.zoom };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const zoom = (pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist;
      setCrop((c, w, h) => cropRect(w, h, { ...c, zoom }).crop);
    } else if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setCrop((c, w, h) => dragCrop(w, h, c, dx, dy, VIEW));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const cancel = () => {
    source?.bitmap.close();
    setSource(null);
    setThumb(undefined);
  };

  const save = () =>
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await toSquareImage(source!);
      } catch {
        return setError("Cette image ne peut pas être lue. Essaie une autre photo.");
      }
      const fd = new FormData();
      fd.set("photo", blob, "photo");
      const r = await uploadPhoto(fd);
      if (r.error) return setError(r.error);
      cancel();
      toast({ message: "Photo enregistrée." });
      router.refresh();
    });

  const remove = async () => {
    if (!(await confirm("Supprimer ta photo ?", { text: "Tes cartes afficheront la silhouette.", confirmLabel: "Supprimer" }))) return;
    startTransition(async () => {
      const r = await deletePhoto();
      if (r.error) return setError(r.error);
      toast({ message: "Photo supprimée." });
      router.refresh();
    });
  };

  const current = version ? `/api/photo/${memberId}?v=${version}` : null;
  return (
    <div className="stack">
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => choose(e.target.files?.[0])} />
      {source ? (
        <>
          <p className="small">Glisse la photo pour placer ton visage dans le rond, et zoome si besoin.</p>
          <div className="photo-crop-row">
            <div className="photo-crop" style={{ width: VIEW, height: VIEW }}>
              <canvas
                ref={view}
                className="photo-crop-canvas"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                aria-label="Photo à recadrer : glisser pour déplacer, pincer pour zoomer"
                role="img"
              />
              <div className="photo-crop-guide" aria-hidden="true" />
            </div>
            {thumb && (
              <div className="photo-crop-card" aria-hidden="true">
                <PlayerCard card={card} photoSrc={thumb} />
              </div>
            )}
          </div>
          <label className="photo-zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.05}
              value={source.crop.zoom}
              onChange={(e) => {
                const zoom = Number(e.target.value);
                setCrop((c, w, h) => cropRect(w, h, { ...c, zoom }).crop);
              }}
            />
          </label>
          <div className="action-row">
            <button type="button" className="btn-primary" onClick={save} disabled={pending}>
              {pending ? "Envoi…" : "Enregistrer la photo"}
            </button>
            <button type="button" className="btn-secondary" onClick={cancel} disabled={pending}>
              Annuler
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="action-row">
            {current ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="photo-preview" src={current} alt="Ma photo" />
            ) : (
              <span className="small">Pas encore de photo.</span>
            )}
          </div>
          <div className="action-row">
            <button type="button" className="btn-secondary" onClick={() => input.current?.click()} disabled={pending}>
              {version ? "Changer de photo" : "Ajouter une photo"}
            </button>
            {version && (
              <button type="button" className="btn-secondary" onClick={remove} disabled={pending}>
                Supprimer
              </button>
            )}
          </div>
        </>
      )}
      <p className="small muted">Pour recentrer une photo déjà envoyée, choisis-la à nouveau. Visible uniquement dans VUT, par les adhérents connectés.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {dialog}
    </div>
  );
}
