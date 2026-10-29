"use client";

import { useActionState, useRef } from "react";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { importMembers, type MemberImportState } from "./actions";

const initialState: MemberImportState = { status: "idle" };

export function ImportMembersForm() {
  const [state, formAction, pending] = useActionState(importMembers, initialState);
  const modeRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="card stack">
      <h2>Importer des adhérents</h2>
      <p className="muted small">
        Fichier Excel (.xlsx) ou CSV, une ligne par adhérent. Colonnes obligatoires : nom, prenom,
        email, sexe. Facultatives : equipe (plusieurs séparées par une virgule), capitaine (oui ou
        nom des équipes), roles, telephone, licence, cotisation, niveau. <a href="/modele-adherents.csv" download>Télécharger le modèle</a>.
      </p>
      <p className="muted small">
        Réimport possible : les fiches sont reconnues par leur email et mises à jour ; les rôles
        et les équipes sont ajoutés (jamais retirés) ; un téléphone saisi par l&apos;adhérent n&apos;est pas écrasé.
      </p>

      <input type="hidden" name="mode" defaultValue="preview" ref={modeRef} />
      <label htmlFor="file">Fichier</label>
      <input id="file" name="file" type="file" accept=".xlsx,.csv,text/csv" required />
      <label className="checkbox">
        <input type="checkbox" name="invite" defaultChecked />
        Envoyer l&apos;email d&apos;invitation aux nouveaux comptes
      </label>

      <button
        type="submit"
        className="btn-secondary"
        disabled={pending}
        onClick={() => modeRef.current && (modeRef.current.value = "preview")}
      >
        {pending ? "Lecture…" : "1. Vérifier le fichier"}
      </button>

      {state.status === "error" && (
        <div className="error" role="alert">
          <p>Rien n&apos;a été importé :</p>
          <ul>
            {state.errors!.slice(0, 20).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {state.errors!.length > 20 && <p>… et {state.errors!.length - 20} autres erreurs.</p>}
        </div>
      )}

      {state.status === "preview" && (
        <div className="stack">
          <p className="notice" role="status">
            Fichier valide : <strong>{state.preview!.created}</strong> nouvelles fiches,{" "}
            <strong>{state.preview!.updated}</strong> mises à jour.
          </p>
          <ul className="preview-list">
            {state.preview!.rows.map((r) => (
              <li key={r.email}>
                <strong>{r.name}</strong> {r.isNew ? <span className="badge home">nouveau</span> : null}
                <br />
                <span className="muted small">
                  {r.email}
                  {r.teams.length > 0 && ` · ${r.teams.join(", ")}`}
                  {r.extra && ` · ${r.extra}`}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            className="btn-primary"
            disabled={pending}
            onClick={() => modeRef.current && (modeRef.current.value = "import")}
          >
            {pending ? "Import en cours…" : "2. Confirmer l'import"}
          </button>
        </div>
      )}

      {state.status === "done" && (
        <div className="notice stack" role="status">
          <p>
            <strong>Import terminé.</strong> {state.summary!.created} fiches créées,{" "}
            {state.summary!.updated} mises à jour, {state.summary!.accounts} comptes de connexion
            créés.
          </p>
          {state.summary!.invitations > 0 && (
            <p>{state.summary!.invitations} invitations en cours d&apos;envoi par email.</p>
          )}
          {state.summary!.problems.length > 0 && (
            <ul className="error">
              {state.summary!.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
