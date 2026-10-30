"use client";

import { useState, useTransition } from "react";
import { useConfirm } from "@/components/Feedback";
import { remindNotConnected } from "./remind-actions";

/** Relance par email des adhérents jamais connectés (avec confirmation : un envoi ne s'annule pas). */
export function RemindButton({ count }: { count: number }) {
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();
  if (!count) return null;
  return (
    <div className="stack">
      {dialog}
      <button
        type="button"
        className="btn-secondary"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm(`Relancer ${count} adhérent${count > 1 ? "s" : ""} par email ?`, {
            text: "Ceux qui ne se sont jamais connectés reçoivent un email avec le lien de l'appli et la marche à suivre. Un envoi ne peut pas être annulé.",
            confirmLabel: "Envoyer",
          });
          if (!ok) return;
          startTransition(async () => {
            const r = await remindNotConnected();
            setStatus(r.error ? { ok: false, text: r.error } : { ok: true, text: `Relance en cours d'envoi à ${r.count} adhérent${(r.count ?? 0) > 1 ? "s" : ""}.` });
          });
        }}
      >
        {pending ? "Envoi…" : `✉ Relancer par email les ${count} non connecté${count > 1 ? "s" : ""}`}
      </button>
      {status && <p className={status.ok ? "success small" : "error small"} role="status">{status.text}</p>}
    </div>
  );
}
