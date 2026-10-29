"use client";

import { useTransition } from "react";
import { deleteAnnouncement } from "@/app/(app)/bureau/annonces/actions";

export function DeleteAnnouncementButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={pending}
      onClick={() => {
        if (confirm("Supprimer cette annonce ?")) startTransition(async () => void (await deleteAnnouncement(id)));
      }}
    >
      Supprimer
    </button>
  );
}
