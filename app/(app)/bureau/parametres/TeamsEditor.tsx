"use client";

import { useState, useTransition } from "react";
import { saveTeam } from "./actions";

function TeamRow({ team }: { team: { id: string; name: string; code: string | null } }) {
  const [name, setName] = useState(team.name);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  return (
    <li className="stack">
      <div className="need-row">
        <input aria-label={`Nom de l'équipe ${team.name}`} value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          className="btn-secondary"
          disabled={pending || name === team.name}
          onClick={() => startTransition(async () => {
            const r = await saveTeam(team.id, name);
            setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Enregistré" });
          })}
        >
          OK
        </button>
      </div>
      <span className="muted small">{team.code ? `Code volley34 : ${team.code}` : "Pas encore reliée à volley34"}</span>
      {msg && <span className={msg.ok ? "success small" : "error small"}>{msg.text}</span>}
    </li>
  );
}

export function TeamsEditor({ teams }: { teams: { id: string; name: string; code: string | null }[] }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <section className="card stack">
      <h2>Équipes</h2>
      <p className="muted small">
        Les équipes sont créées par l&apos;import du calendrier et la synchro volley34. Renommer une équipe
        ne casse pas la synchro (elle la retrouve par son code).
      </p>
      <ul className="list">{teams.map((t) => <TeamRow key={t.id} team={t} />)}</ul>
      <div className="need-row">
        <input aria-label="Nouvelle équipe" placeholder="Nouvelle équipe" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          className="btn-secondary"
          disabled={pending || !name.trim()}
          onClick={() => startTransition(async () => {
            const r = await saveTeam(null, name);
            setError(r.error);
            if (!r.error) setName("");
          })}
        >
          Ajouter
        </button>
      </div>
      {error && <p className="error small" role="alert">{error}</p>}
    </section>
  );
}
