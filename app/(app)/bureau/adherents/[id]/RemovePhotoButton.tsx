"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { removeMemberPhoto } from "./photo-actions";

/** Bureau : retirer une photo de joueur jugée inappropriée (avec confirmation). */
export function RemovePhotoButton({ id, name, version }: { id: string; name: string; version: string }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <section className="card stack">
      {dialog}
      <h2>Photo (jeu de cartes)</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="photo-preview" src={`/api/photo/${id}?v=${version}`} alt={`Photo de ${name}`} />
      <button
        type="button"
        className="btn-secondary"
        disabled={pending}
        onClick={async () => {
          if (!(await confirm(`Retirer la photo de ${name} ?`, { text: "Ses cartes afficheront la silhouette.", confirmLabel: "Retirer" }))) return;
          startTransition(async () => {
            const r = await removeMemberPhoto(id);
            if (r.error) return setError(r.error);
            toast({ message: "Photo retirée." });
            router.refresh();
          });
        }}
      >
        Retirer la photo
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
