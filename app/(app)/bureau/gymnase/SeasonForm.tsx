"use client";

import { useActionState } from "react";
import { createSeason, type SeasonState } from "./actions";

const initialState: SeasonState = { status: "idle" };

export function SeasonForm({ from, to }: { from: string; to: string }) {
  const [state, formAction, pending] = useActionState(createSeason, initialState);

  return (
    <form action={formAction} className="card stack">
      <h2>Créer les séances de la saison</h2>
      <p className="muted small">
        Tous les mardis et jeudis 20h–22h, 3 terrains. Vacances scolaires (zone C) et jours fériés
        à 0 terrain : vous pourrez les rouvrir ensuite.
      </p>
      <label htmlFor="from">Premier entraînement</label>
      <input id="from" name="from" type="date" defaultValue={from} required />
      <label htmlFor="to">Dernier entraînement</label>
      <input id="to" name="to" type="date" defaultValue={to} required />
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Création…" : "Créer les séances"}
      </button>
      {state.status === "done" && <p className="success" role="status">{state.message}</p>}
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
    </form>
  );
}
