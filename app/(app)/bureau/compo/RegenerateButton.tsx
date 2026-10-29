"use client";

import { useState, useTransition } from "react";
import { regenerateLineup } from "./actions";

export function RegenerateButton({ sessionId, exists }: { sessionId: string; exists: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="stack">
      <button
        type="button"
        className={exists ? "btn-secondary" : "btn-primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await regenerateLineup(sessionId);
            setError(r.error);
          })
        }
      >
        {pending ? "Calcul…" : exists ? "Régénérer avec les réponses actuelles" : "Générer la compo maintenant"}
      </button>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
