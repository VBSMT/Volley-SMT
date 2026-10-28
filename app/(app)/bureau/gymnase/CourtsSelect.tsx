"use client";

import { useState, useTransition } from "react";
import { setOpenCourts } from "./actions";

export function CourtsSelect({ sessionId, value, label }: { sessionId: string; value: number; label: string }) {
  const [courts, setCourts] = useState(value);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <select
        aria-label={`Terrains ouverts le ${label}`}
        value={courts}
        disabled={pending}
        onChange={(e) => {
          const next = Number(e.target.value);
          const previous = courts;
          setCourts(next);
          startTransition(async () => {
            const result = await setOpenCourts(sessionId, next);
            if (result.error) {
              setCourts(previous);
              setError(result.error);
            } else setError(undefined);
          });
        }}
      >
        {[0, 1, 2, 3].map((n) => (
          <option key={n} value={n}>
            {n === 0 ? "Fermé" : `${n} terrain${n > 1 ? "s" : ""}`}
          </option>
        ))}
      </select>
      {error && <span className="error small" role="alert">{error}</span>}
    </>
  );
}
