"use client";

import { useActionState, useState, useTransition } from "react";
import { EVENT_TYPE_LABELS, VISIBILITY_ROLES, type EventType, type Role } from "@/lib/domain/events";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { deleteEvent, saveEvent, type EventFormState } from "./actions";

export type EventFormValues = {
  id: string | null;
  type: EventType;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  visibleRoles: Role[];
  attendancePoll: boolean;
  askPartner: boolean;
  askChildren: boolean;
  askGuests: boolean;
  volunteerPoll: boolean;
  needs: { label: string; needed: number }[];
};

const initialState: EventFormState = { status: "idle" };

export function EventForm({ values }: { values: EventFormValues }) {
  const [state, formAction, pending] = useActionState(saveEvent.bind(null, values.id), initialState);
  const [restricted, setRestricted] = useState(values.visibleRoles.length > 0);
  const [attendance, setAttendance] = useState(values.attendancePoll);
  const [volunteer, setVolunteer] = useState(values.volunteerPoll);
  const [needs, setNeeds] = useState(values.needs.length ? values.needs : [{ label: "", needed: 1 }]);
  const [deleting, startDelete] = useTransition();

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="stack">
      <section className="card stack">
        <label htmlFor="type">Type</label>
        <select id="type" name="type" defaultValue={values.type}>
          {Object.entries(EVENT_TYPE_LABELS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <label htmlFor="title">Titre</label>
        <input id="title" name="title" defaultValue={values.title} maxLength={120} required />
        <div className="two-cols">
          <div className="stack">
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" defaultValue={values.date} required />
          </div>
          <div className="stack">
            <label htmlFor="time">Heure</label>
            <input id="time" name="time" type="time" defaultValue={values.time} required />
          </div>
        </div>
        <label htmlFor="location">Lieu</label>
        <input id="location" name="location" defaultValue={values.location} maxLength={120} />
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={4} defaultValue={values.description} maxLength={4000} />
      </section>

      <fieldset className="card stack">
        <legend>Visible par</legend>
        <label className="checkbox">
          <input type="radio" name="visibility" value="all" checked={!restricted} onChange={() => setRestricted(false)} />
          Tous les adhérents
        </label>
        <label className="checkbox">
          <input type="radio" name="visibility" value="roles" checked={restricted} onChange={() => setRestricted(true)} />
          Seulement certains rôles
        </label>
        {restricted &&
          VISIBILITY_ROLES.map((v) => (
            <label key={v.role} className="checkbox sub">
              <input type="checkbox" name="roles" value={v.role} defaultChecked={values.visibleRoles.includes(v.role)} />
              {v.label}
            </label>
          ))}
        <p className="muted small">Le Bureau voit toujours tous les événements.</p>
      </fieldset>

      <fieldset className="card stack">
        <legend>Sondages</legend>
        <label className="checkbox">
          <input type="checkbox" name="attendance_poll" checked={attendance} onChange={(e) => setAttendance(e.target.checked)} />
          Présence des adhérents (je viens / je ne viens pas)
        </label>
        {attendance && (
          <>
            <label className="checkbox sub">
              <input type="checkbox" name="ask_partner" defaultChecked={values.askPartner} />
              Demander la venue d&apos;un·e conjoint·e
            </label>
            <label className="checkbox sub">
              <input type="checkbox" name="ask_children" defaultChecked={values.askChildren} />
              Demander le nombre d&apos;enfants
            </label>
            <label className="checkbox sub">
              <input type="checkbox" name="ask_guests" defaultChecked={values.askGuests} />
              Demander le nombre d&apos;autres invités
            </label>
          </>
        )}
        <label className="checkbox">
          <input type="checkbox" name="volunteer_poll" checked={volunteer} onChange={(e) => setVolunteer(e.target.checked)} />
          Participation bénévole (bénévoles et Bureau)
        </label>
        {volunteer && (
          <div className="stack sub">
            <p className="muted small">Besoins par poste :</p>
            {needs.map((n, i) => (
              <div key={i} className="need-row">
                <input
                  name="need_label"
                  aria-label={`Poste ${i + 1}`}
                  placeholder="Ex. : buvette"
                  value={n.label}
                  onChange={(e) => setNeeds((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  name="need_count"
                  type="number"
                  min={1}
                  max={50}
                  aria-label={`Nombre pour le poste ${i + 1}`}
                  value={n.needed}
                  onChange={(e) => setNeeds((all) => all.map((x, j) => (j === i ? { ...x, needed: Number(e.target.value) } : x)))}
                />
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => setNeeds((all) => [...all, { label: "", needed: 1 }])}>
              + Ajouter un poste
            </button>
          </div>
        )}
      </fieldset>

      {!values.id && (
        <label className="checkbox">
          <input type="checkbox" name="notify" defaultChecked />
          Prévenir les adhérents concernés (notification, sinon email)
        </label>
      )}
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : values.id ? "Enregistrer les modifications" : "Créer l'événement"}
      </button>
      {values.id && (
        <button
          type="button"
          className="btn-secondary"
          disabled={deleting}
          onClick={() => {
            if (confirm("Supprimer cet événement et toutes les réponses ?")) startDelete(async () => void (await deleteEvent(values.id!)));
          }}
        >
          Supprimer l&apos;événement
        </button>
      )}
    </form>
  );
}
