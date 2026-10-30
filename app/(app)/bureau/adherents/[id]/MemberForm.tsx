"use client";

import { useActionState, useState } from "react";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { updateMember, type EditState } from "./actions";

const initialState: EditState = { status: "idle" };

export type MemberFormData = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  /** Modifiable tant que l'adhérent ne s'est jamais connecté. */
  emailEditable: boolean;
  sex: "F" | "M";
  fsgt_license: string | null;
  dues_paid: boolean;
  teamIds: string[];
  captainOf: string[];
  roles: string[];
  level: number | null;
};

export function MemberForm({ member, teams }: { member: MemberFormData; teams: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(updateMember.bind(null, member.id), initialState);
  const [selected, setSelected] = useState(member.teamIds);

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="stack">
      <section className="card stack">
        <h2>Identité</h2>
        <label htmlFor="last_name">Nom</label>
        <input id="last_name" name="last_name" defaultValue={member.last_name} required />
        <label htmlFor="first_name">Prénom</label>
        <input id="first_name" name="first_name" defaultValue={member.first_name} required />
        <label htmlFor="email">Email (connexion)</label>
        {member.emailEditable ? (
          <input id="email" name="email" type="email" defaultValue={member.email} autoComplete="off" required />
        ) : (
          <>
            <input id="email" value={member.email} readOnly aria-describedby="email-help" />
            <p id="email-help" className="small muted">Non modifiable : l&apos;adhérent s&apos;est déjà connecté avec cet email.</p>
          </>
        )}
        <label htmlFor="sex">Sexe</label>
        <select id="sex" name="sex" defaultValue={member.sex}>
          <option value="F">Femme</option>
          <option value="M">Homme</option>
        </select>
        <label htmlFor="fsgt_license">Licence FSGT</label>
        <input id="fsgt_license" name="fsgt_license" defaultValue={member.fsgt_license ?? ""} />
        <label className="checkbox">
          <input type="checkbox" name="dues_paid" defaultChecked={member.dues_paid} />
          Cotisation réglée
        </label>
      </section>

      <section className="card stack">
        <h2>Équipes</h2>
        <p className="muted small">Cochez ses équipes, puis « capitaine » pour celles dont il ou elle est responsable.</p>
        <ul className="team-picker">
          {teams.map((t) => {
            const inTeam = selected.includes(t.id);
            return (
              <li key={t.id}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="teams"
                    value={t.id}
                    checked={inTeam}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)))
                    }
                  />
                  {t.name}
                </label>
                <label className={inTeam ? "checkbox small" : "checkbox small disabled"}>
                  <input
                    type="checkbox"
                    name="captain"
                    value={t.id}
                    defaultChecked={member.captainOf.includes(t.id)}
                    disabled={!inTeam}
                  />
                  capitaine
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card stack">
        <h2>Rôles et niveau</h2>
        <label className="checkbox">
          <input type="checkbox" name="roles" value="board" defaultChecked={member.roles.includes("board")} />
          Bureau
        </label>
        <label className="checkbox">
          <input type="checkbox" name="roles" value="volunteer" defaultChecked={member.roles.includes("volunteer")} />
          Bénévole
        </label>
        <label htmlFor="level">Niveau (visible du Bureau uniquement)</label>
        <select id="level" name="level" defaultValue={member.level ?? ""}>
          <option value="">Non renseigné</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </section>

      {state.status === "saved" && <p className="success" role="status">Fiche enregistrée.</p>}
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
