"use client";

import { useTransition } from "react";
import { deleteAnnouncement, setAnnouncementActive } from "@/app/(app)/bureau/annonces/actions";
import { useConfirm, useToast } from "@/components/Feedback";

/** Actions du Bureau sur une annonce : désactiver / réactiver (accueil), supprimer définitivement. */
export function DeleteAnnouncementButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();

  const toggle = async () => {
    const title = active ? "Désactiver cette annonce ?" : "Réactiver cette annonce ?";
    const text = active ? "Elle n'apparaîtra plus sur l'accueil, mais reste dans l'historique des annonces." : "Elle réapparaîtra sur l'accueil des destinataires.";
    if (!(await confirm(title, { text, confirmLabel: active ? "Désactiver" : "Réactiver" }))) return;
    startTransition(async () => {
      const r = await setAnnouncementActive(id, !active);
      if (r.error) return toast({ message: r.error });
      toast({ message: active ? "Annonce désactivée." : "Annonce réactivée.", undo: () => setAnnouncementActive(id, active) });
    });
  };

  return (
    <div className="action-row announcement-actions">
      {dialog}
      <button type="button" className="chip chip-small" disabled={pending} onClick={toggle}>
        {active ? "⏸ Désactiver" : "▶ Réactiver"}
      </button>
      <button
        type="button"
        className="chip chip-small"
        disabled={pending}
        onClick={async () => {
          if (!(await confirm("Supprimer cette annonce ?", { text: "Elle disparaîtra de l'appli et de l'historique (les notifications déjà reçues restent).", confirmLabel: "Supprimer" }))) return;
          startTransition(async () => {
            await deleteAnnouncement(id);
            toast({ message: "Annonce supprimée." });
          });
        }}
      >
        🗑 Supprimer
      </button>
    </div>
  );
}
