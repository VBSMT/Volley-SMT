"use client";

import { useTransition } from "react";
import { deleteAnnouncement } from "@/app/(app)/bureau/annonces/actions";
import { useConfirm, useToast } from "@/components/Feedback";

export function DeleteAnnouncementButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  return (
    <>
    {dialog}
    <button
      type="button"
      className="btn-secondary"
      disabled={pending}
      onClick={async () => {
        if (!(await confirm("Supprimer cette annonce ?", { text: "Elle disparaîtra de l'appli (les notifications déjà reçues restent).", confirmLabel: "Supprimer" }))) return;
        startTransition(async () => {
          await deleteAnnouncement(id);
          toast({ message: "Annonce supprimée." });
        });
      }}
    >
      Supprimer
    </button>
    </>
  );
}
