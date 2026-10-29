"use client";

import { useState, useTransition } from "react";
import { closeReinforcement, offerHelp, withdrawHelp } from "@/app/(app)/renforts/actions";

export function OfferButton({ requestId, offered }: { requestId: string; offered: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.error);
    });

  return (
    <div className="stack">
      {offered ? (
        <>
          <p className="success small">Vous avez proposé votre aide : le capitaine est prévenu.</p>
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => withdrawHelp(requestId))}>
            Retirer ma proposition
          </button>
        </>
      ) : (
        <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => offerHelp(requestId))}>
          {pending ? "Envoi…" : "Je peux aider"}
        </button>
      )}
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}

export function CloseButtons({ requestId }: { requestId: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const close = (status: "filled" | "cancelled") =>
    startTransition(async () => {
      const result = await closeReinforcement(requestId, status);
      setError(result.error);
    });

  return (
    <div className="stack">
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
