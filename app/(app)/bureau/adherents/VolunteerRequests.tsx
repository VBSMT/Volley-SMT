"use client";

import { useState, useTransition } from "react";
import { decideVolunteerRequest } from "./volunteer-actions";

export function VolunteerRequests({ requests }: { requests: { id: string; name: string; at: string }[] }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const decide = (id: string, approve: boolean) =>
    startTransition(async () => {
      const r = await decideVolunteerRequest(id, approve);
      setError(r.error);
    });

  return (
    <section className="card stack" id="benevoles">
      <h2>Demandes « Devenir bénévole » ({requests.length})</h2>
      <ul className="list">
        {requests.map((r) => (
          <li key={r.id} className="stack">
            <p>
              <strong>{r.name}</strong> <span className="muted small">· {r.at}</span>
            </p>
            <div className="poll">
              <button type="button" className="poll-btn yes" disabled={pending} onClick={() => decide(r.id, true)}>
                Valider
              </button>
              <button type="button" className="poll-btn" disabled={pending} onClick={() => decide(r.id, false)}>
                Refuser
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="error small" role="alert">{error}</p>}
    </section>
  );
}
