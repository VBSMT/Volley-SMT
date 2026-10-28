"use client";

import { useActionState } from "react";
import { importMatches, type ImportState } from "./actions";

const initialState: ImportState = { status: "idle" };

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importMatches, initialState);

  return (
    <form action={formAction} className="card stack">
      <h2>Importer le calendrier</h2>
      <p className="muted small">
        Fichier Excel du club (une ligne par match). Vous pouvez le réimporter à chaque mise à
        jour : les matchs existants sont mis à jour, sans doublon.
      </p>
      <label htmlFor="file">Fichier .xlsx</label>
      <input
        id="file"
        name="file"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        required
      />
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Import en cours…" : "Importer"}
      </button>

      {state.status === "error" && (
        <div className="error" role="alert">
          <p>Rien n&apos;a été importé :</p>
          <ul>
            {state.errors!.slice(0, 15).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {state.errors!.length > 15 && <p>… et {state.errors!.length - 15} autres erreurs.</p>}
        </div>
      )}

      {state.status === "done" && (
        <div className="notice" role="status">
          <p>
            <strong>Import terminé.</strong> {state.summary!.created} matchs ajoutés,{" "}
            {state.summary!.updated} mis à jour
            {state.summary!.moved > 0 && ` (dont ${state.summary!.moved} changements de date)`}.
          </p>
          {state.summary!.teamsCreated.length > 0 && (
            <p>Équipes créées : {state.summary!.teamsCreated.join(", ")}.</p>
          )}
          {state.summary!.missing > 0 && (
            <p>
              {state.summary!.missing} matchs déjà enregistrés sont absents du fichier ; ils ont
              été conservés.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
