"use client";

import { useState, useTransition } from "react";
import { requestVolunteer } from "./actions";

export function VolunteerRequest() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setConfirming(true)}>
        Devenir bénévole
      </button>
    );
  }

  return (
    <div className="stack">
      <p>
        Votre demande sera envoyée au Bureau. Une fois validée, vous pourrez répondre aux sondages
        de participation bénévole des événements.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await requestVolunteer();
            if (result.status === "error") setError(result.message);
          })
        }
      >
        {pending ? "Envoi…" : "Confirmer ma demande"}
      </button>
      <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
        Annuler
      </button>
    </div>
  );
}
