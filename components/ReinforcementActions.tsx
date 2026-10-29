"use client";

import { useState, useTransition } from "react";
import { closeReinforcement, offerHelp, reopenReinforcement, withdrawHelp } from "@/app/(app)/renforts/actions";
import { useConfirm, useToast } from "@/components/Feedback";

export function OfferButton({ requestId, offered }: { requestId: string; offered: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const offer = async () => {
    if (!(await confirm("Proposer votre aide ?", { text: "Le capitaine sera prévenu.", confirmLabel: "Je propose" }))) return;
    startTransition(async () => {
      const r = await offerHelp(requestId);
      setError(r.error);
      if (!r.error) toast({ message: "Proposition envoyée au capitaine.", undo: () => withdrawHelp(requestId) });
    });
  };
  const withdraw = async () => {
    if (!(await confirm("Retirer votre proposition ?", { confirmLabel: "Retirer" }))) return;
    startTransition(async () => {
      const r = await withdrawHelp(requestId);
      setError(r.error);
      if (!r.error) toast({ message: "Proposition retirée.", undo: () => offerHelp(requestId) });
    });
  };

  return (
    <div className="stack">
      {dialog}
      {offered ? (
        <>
          <p className="success small">Vous avez proposé votre aide : le capitaine est prévenu.</p>
          <button type="button" className="btn-secondary" disabled={pending} onClick={withdraw}>
            Retirer ma proposition
          </button>
        </>
      ) : (
        <button type="button" className="btn-primary" disabled={pending} onClick={offer}>
          {pending ? "Envoi…" : "Je peux aider"}
        </button>
      )}
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}

const CLOSE_LABELS = {
  filled: { title: "Marquer le renfort comme trouvé ?", done: "Renfort trouvé : demande close." },
  cancelled: { title: "Annuler la demande de renfort ?", done: "Demande de renfort annulée." },
};

export function CloseButtons({ requestId }: { requestId: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const close = async (status: "filled" | "cancelled") => {
    if (!(await confirm(CLOSE_LABELS[status].title, { text: "La demande disparaîtra de l'accueil des adhérents." }))) return;
    startTransition(async () => {
      const result = await closeReinforcement(requestId, status);
      setError(result.error);
      if (!result.error) toast({ message: CLOSE_LABELS[status].done, undo: () => reopenReinforcement(requestId) });
    });
  };

  return (
    <div className="stack">
      {dialog}
      <div className="poll">
        <button type="button" className="poll-btn yes" disabled={pending} onClick={() => close("filled")}>
          Renfort trouvé
        </button>
        <button type="button" className="poll-btn" disabled={pending} onClick={() => close("cancelled")}>
          Annuler la demande
        </button>
      </div>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
