"use client";

import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { setTeamCount } from "./actions";

/** Ajouter / supprimer une équipe : la compo est recalculée avec ce nombre d'équipes. */
export function TeamCountControls({
  sessionId,
  count,
  forced,
  present,
}: {
  sessionId: string;
  count: number;
  /** Nombre fixé à la main (null = automatique). */
  forced: number | null;
  present: number;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const apply = async (next: number | null, title: string, done: string) => {
    const ok = await confirm(title, {
      text: "La compo est recalculée : les déplacements faits à la main sont perdus.",
      confirmLabel: "Recalculer",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await setTeamCount(sessionId, next);
      setError(r.error);
      if (!r.error) toast({ message: done, undo: () => setTeamCount(sessionId, forced) });
    });
  };

  return (
    <div className="stack team-count">
      {dialog}
      <p className="small">
        <strong>
          {count} équipe{count > 1 ? "s" : ""}
        </strong>{" "}
        {forced ? "(fixé à la main)" : "(nombre automatique)"}
      </p>
      <div className="action-row">
        <button
          type="button"
          className="btn-secondary"
          disabled={pending || count <= 2}
          onClick={() => apply(count - 1, `Supprimer une équipe (${count - 1} équipes) ?`, `Compo recalculée en ${count - 1} équipes.`)}
        >
          − Supprimer une équipe
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending || count >= Math.min(20, present)}
          onClick={() => apply(count + 1, `Ajouter une équipe (${count + 1} équipes) ?`, `Compo recalculée en ${count + 1} équipes.`)}
        >
          ＋ Ajouter une équipe
        </button>
      </div>
      {forced !== null && (
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => apply(null, "Revenir au nombre d'équipes automatique ?", "Compo recalculée (nombre automatique).")}
        >
          Revenir au nombre automatique
        </button>
      )}
      {pending && <p className="muted small" role="status">Recalcul…</p>}
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
