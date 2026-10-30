"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { deletePhoto, uploadPhoto } from "./photo-actions";

const SIZE = 320;

/** Recadre au centre en carré de 320 px et compresse en WebP (≈ 20 à 30 Ko) dans le navigateur. */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("webp"))), "image/webp", 0.8));
}

/** Photo des cartes du jeu : ajout, remplacement, suppression (droit à l'image requis). */
export function PhotoEditor({ memberId, consent, version }: { memberId: string; consent: boolean; version: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!consent) {
    return <p className="small">Pour mettre ta photo sur tes cartes VUT, coche le droit à l&apos;image puis enregistre.</p>;
  }

  async function choose(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    try {
      const blob = await toSquareWebp(file);
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch {
      setError("Cette image ne peut pas être lue. Essaie une autre photo.");
    }
  }

  const save = () =>
    startTransition(async () => {
      const fd = new FormData();
      fd.set("photo", preview!.blob, "photo.webp");
      const r = await uploadPhoto(fd);
      if (r.error) return setError(r.error);
      setPreview(null);
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

  const current = preview?.url ?? (version ? `/api/photo/${memberId}?v=${version}` : null);
  return (
    <div className="stack">
      <div className="action-row">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="photo-preview" src={current} alt="Ma photo" />
        ) : (
          <span className="small">Pas encore de photo.</span>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => choose(e.target.files?.[0])} />
      {preview ? (
        <div className="action-row">
          <button type="button" className="btn-primary" onClick={save} disabled={pending}>
            {pending ? "Envoi…" : "Enregistrer la photo"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setPreview(null)} disabled={pending}>
            Annuler
          </button>
        </div>
      ) : (
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
      )}
      <p className="small muted">Recadrée au centre en carré. Visible uniquement dans VUT, par les adhérents connectés.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {dialog}
    </div>
  );
}
