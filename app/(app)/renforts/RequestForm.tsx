"use client";

import { useActionState } from "react";
import { POSITION_LABELS } from "@/lib/member-types";
import { createReinforcement, type RequestState } from "./actions";

const initialState: RequestState = { status: "idle" };

export function RequestForm({
  matches,
  defaultMatchId,
}: {
  matches: { id: string; label: string }[];
  defaultMatchId?: string;
}) {
  const [state, formAction, pending] = useActionState(createReinforcement, initialState);

  return (
    <form action={formAction} className="card stack">
      <label htmlFor="match_id">Match concerné</label>
      <select id="match_id" name="match_id" defaultValue={defaultMatchId} required>
        {matches.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      <label htmlFor="position">Poste</label>
      <select id="position" name="position" defaultValue="">
        <option value="">Indifférent</option>
        {Object.entries(POSITION_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      <label htmlFor="sex">Joueur ou joueuse</label>
      <select id="sex" name="sex" defaultValue="">
        <option value="">Indifférent</option>
        <option value="F">Une joueuse</option>
        <option value="M">Un joueur</option>
      </select>

      <label htmlFor="note">Message (facultatif)</label>
      <textarea id="note" name="note" rows={3} maxLength={300} placeholder="Ex. : covoiturage possible depuis le gymnase" />

      <p className="muted small">
        La demande s&apos;affiche sur l&apos;accueil de tous les adhérents, et une notification est
        envoyée à ceux qui correspondent (hors de votre équipe).
      </p>
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Envoi…" : "Publier la demande"}
      </button>
    </form>
  );
}
