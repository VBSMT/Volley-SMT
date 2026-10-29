"use client";

import { useActionState } from "react";
import { POSITION_LABELS, type CurrentMember, type Position } from "@/lib/member-types";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { updateProfile, type ProfileState } from "./actions";

const initialState: ProfileState = { status: "idle" };

function PositionSelect({ name, label, value }: { name: string; label: string; value: Position | null }) {
  return (
    <>
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? ""}>
        <option value="">Non renseigné</option>
        {Object.entries(POSITION_LABELS).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </>
  );
}

export function ProfileForm({ member }: { member: CurrentMember }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="card stack">
      <h2>Mes informations</h2>

      <label htmlFor="phone">Téléphone</label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={member.phone ?? ""} />

      <fieldset className="stack">
        <legend>Contact d&apos;urgence</legend>
        <label htmlFor="emergency_contact_name">Nom</label>
        <input
          id="emergency_contact_name"
          name="emergency_contact_name"
          defaultValue={member.emergency_contact_name ?? ""}
        />
        <label htmlFor="emergency_contact_phone">Téléphone</label>
        <input
          id="emergency_contact_phone"
          name="emergency_contact_phone"
          type="tel"
          defaultValue={member.emergency_contact_phone ?? ""}
        />
      </fieldset>

      <PositionSelect name="position_1" label="Poste préféré" value={member.position_1} />
      <PositionSelect name="position_2" label="Deuxième poste" value={member.position_2} />

      <label className="checkbox">
        <input type="checkbox" name="image_consent" defaultChecked={member.image_consent} />
        J&apos;accepte que le club publie des photos où j&apos;apparais
      </label>

      {state.status === "saved" && <p className="success" role="status">Modifications enregistrées.</p>}
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
