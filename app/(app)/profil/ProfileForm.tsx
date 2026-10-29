"use client";

import { useActionState, useEffect, useState } from "react";
import { PLAYER_POSITIONS, POSITION_LABELS, type CurrentMember, type Position } from "@/lib/member-types";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { updateProfile, type ProfileState } from "./actions";

const initialState: ProfileState = { status: "idle" };

function PositionSelect({ name, label, value }: { name: string; label: string; value: Position | null }) {
  return (
    <>
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? ""}>
        <option value="">Non renseigné</option>
        {/* Ancien choix « Avant » (côté non précisé) : affiché tant qu'il n'est pas remplacé. */}
        {(value === "front" ? (["front", ...PLAYER_POSITIONS] as Position[]) : PLAYER_POSITIONS).map((key) => (
          <option key={key} value={key}>
            {key === "front" ? "Avant (côté à préciser)" : POSITION_LABELS[key]}
          </option>
        ))}
      </select>
    </>
  );
}

/**
 * Contact d'urgence : une fois renseigné, affiché en clair avec un bouton « Modifier »
 * (les valeurs restent envoyées avec le formulaire via des champs cachés).
 */
function EmergencyContact({ name, phone, saved }: { name: string; phone: string; saved: number }) {
  const [values, setValues] = useState({ name, phone });
  const [editing, setEditing] = useState(!name && !phone);
  // Après « Enregistrer », on revient à l'affichage si le contact est renseigné.
  useEffect(() => {
    if (saved) setEditing((e) => (e && (values.name || values.phone) ? false : e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  if (!editing) {
    return (
      <fieldset className="stack">
        <legend>Contact d&apos;urgence</legend>
        <div className="contact-view">
          <p>
            <strong>{values.name || "Nom non renseigné"}</strong>
            <br />
            {values.phone ? <a href={`tel:${values.phone.replace(/\s/g, "")}`}>{values.phone}</a> : <span className="muted">Téléphone non renseigné</span>}
          </p>
          <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
            Modifier
          </button>
        </div>
        <input type="hidden" name="emergency_contact_name" value={values.name} />
        <input type="hidden" name="emergency_contact_phone" value={values.phone} />
      </fieldset>
    );
  }
  return (
    <fieldset className="stack">
      <legend>Contact d&apos;urgence</legend>
      <label htmlFor="emergency_contact_name">Nom</label>
      <input
        id="emergency_contact_name"
        name="emergency_contact_name"
        value={values.name}
        onChange={(e) => setValues({ ...values, name: e.target.value })}
      />
      <label htmlFor="emergency_contact_phone">Téléphone</label>
      <input
        id="emergency_contact_phone"
        name="emergency_contact_phone"
        type="tel"
        value={values.phone}
        onChange={(e) => setValues({ ...values, phone: e.target.value })}
      />
      <p className="muted small">Pensez à « Enregistrer » en bas du bloc.</p>
    </fieldset>
  );
}

export function ProfileForm({ member }: { member: CurrentMember }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  // Compteur d'enregistrements réussis (chaque envoi renvoie un nouvel objet d'état).
  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => {
    if (state.status === "saved") setSavedCount((n) => n + 1);
  }, [state]);

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="card stack">
      <h2>Mes informations</h2>

      <div className="stack" data-tour="contact">
      <label htmlFor="phone">Téléphone</label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={member.phone ?? ""} />

      <EmergencyContact
        name={member.emergency_contact_name ?? ""}
        phone={member.emergency_contact_phone ?? ""}
        saved={savedCount}
      />
      </div>

      <div className="stack" data-tour="positions">
        <PositionSelect name="position_1" label="Poste préféré" value={member.position_1} />
        <PositionSelect name="position_2" label="Deuxième poste" value={member.position_2} />
      </div>

      <label className="checkbox" data-tour="image">
        <input type="checkbox" name="image_consent" defaultChecked={member.image_consent} />
        J&apos;accepte que le club publie des photos où j&apos;apparais
      </label>

      {state.status === "saved" && <p className="success" role="status">Modifications enregistrées.</p>}
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}

      <button type="submit" className="btn-primary" disabled={pending} data-tour="save">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
