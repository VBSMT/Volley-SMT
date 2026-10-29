"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { deleteMember } from "./actions";

export function DeleteMemberButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <section className="card stack danger-zone">
      {dialog}
      <h2>Supprimer l&apos;adhérent</h2>
      <p className="muted small">
        Supprime définitivement la fiche, le compte de connexion, le niveau, les réponses aux sondages et les
        propositions d&apos;aide. Irréversible : pour un départ en fin de saison, la purge RGPD s&apos;en charge déjà.
      </p>
      <button
        type="button"
        className="btn-danger"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm(`Supprimer définitivement ${name} ?`, {
            text: "Fiche, compte, niveau et réponses seront effacés. Cette action ne peut pas être annulée.",
            confirmLabel: "Supprimer définitivement",
          });
          if (!ok) return;
          startTransition(async () => {
            const r = await deleteMember(id);
            if (r.error) return setError(r.error);
            toast({ message: `${name} a été supprimé·e.` });
            router.push("/bureau/adherents");
          });
        }}
      >
        {pending ? "Suppression…" : "Supprimer l'adhérent"}
      </button>
      {error && <p className="error small" role="alert">{error}</p>}
    </section>
  );
}
