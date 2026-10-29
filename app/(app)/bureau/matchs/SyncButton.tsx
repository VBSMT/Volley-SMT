"use client";

import { useState, useTransition } from "react";
import { syncNow } from "./actions";

export function SyncButton() {
  const [result, setResult] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="stack">
      <button
        type="button"
        className="btn-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await syncNow();
            setResult({ ok: r.ok, text: r.text });
          })
        }
      >
        {pending ? "Synchronisation…" : "Synchroniser avec volley34 maintenant"}
      </button>
      {result && (
        <p className={result.ok ? "success small" : "error small"} role="status">
          {result.text}
        </p>
      )}
    </div>
  );
}
