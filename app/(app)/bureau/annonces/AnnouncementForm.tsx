"use client";

import { useActionState, useState } from "react";
import { useConfirm } from "@/components/Feedback";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { createAnnouncement, type AnnouncementState } from "./actions";

const initialState: AnnouncementState = { status: "idle" };

export function AnnouncementForm({
  teams,
  sessions,
}: {
  teams: { id: string; name: string }[];
  sessions: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(createAnnouncement, initialState);
  const [target, setTarget] = useState("club");
  const { confirm, dialog } = useConfirm();

  if (state.status === "sent") {
    return (
      <div className="card stack">
        <p className="success" role="status">{state.message}</p>
        <a href="/bureau/annonces" className="btn-secondary center">Nouvelle annonce</a>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitWithoutReset(formAction, (fd) =>
        confirm(`Envoyer l'annonce « ${fd.get("title")} » ?`, {
          text: "Push, sinon email, aux destinataires choisis. Un envoi ne peut pas être annulé.",
          confirmLabel: "Envoyer",
        }),
      )}
      className="card stack"
    >
      {dialog}
      <h2>Nouvelle annonce</h2>
      <label htmlFor="target">Destinataires</label>
      <select id="target" name="target" value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="club">Tout le club</option>
        <option value="team">Une équipe</option>
        <option value="volunteers">Les bénévoles</option>
        <option value="session">Les inscrits d&apos;une séance</option>
      </select>
      {target === "team" && (
        <>
          <label htmlFor="team_id">Équipe</label>
          <select id="team_id" name="team_id" required>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </>
      )}
      {target === "session" && (
        <>
          <label htmlFor="session_id">Séance</label>
          <select id="session_id" name="session_id" required>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="title">Titre</label>
      <input id="title" name="title" maxLength={120} required placeholder="Ex. : Gymnase fermé jeudi" />
      <label htmlFor="body">Message</label>
      <textarea id="body" name="body" rows={5} maxLength={4000} required />
      <label className="checkbox">
        <input type="checkbox" name="notify" defaultChecked />
        Envoyer une notification (sinon email) aux destinataires
      </label>
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Publication…" : "Publier"}
      </button>
    </form>
  );
}
