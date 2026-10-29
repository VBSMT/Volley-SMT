"use client";

import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { setAttendance } from "./actions";

type Person = { id: string; name: string };

/** Ajustement manuel des présents d'une séance (Bureau). */
export function AttendanceEditor({
  sessionId,
  present,
  others,
}: {
  sessionId: string;
  present: Person[];
  /** Adhérents non inscrits présents, avec leur réponse actuelle (false = « je ne viens pas », null = pas répondu). */
  others: (Person & { answer: boolean | null })[];
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const add = async () => {
    const person = others.find((o) => o.id === selected);
    if (!person) return;
    if (!(await confirm(`Ajouter ${person.name} aux présents ?`, { confirmLabel: "Ajouter" }))) return;
    startTransition(async () => {
      const r = await setAttendance(sessionId, person.id, true);
      setError(r.error);
      if (!r.error) {
        setSelected("");
        toast({ message: `${person.name} ajouté·e aux présents.`, undo: () => setAttendance(sessionId, person.id, person.answer) });
      }
    });
  };

  const remove = async (person: Person) => {
    if (!(await confirm(`Retirer ${person.name} des présents ?`, { confirmLabel: "Retirer" }))) return;
    startTransition(async () => {
      const r = await setAttendance(sessionId, person.id, false);
      setError(r.error);
      if (!r.error) toast({ message: `${person.name} retiré·e des présents.`, undo: () => setAttendance(sessionId, person.id, true) });
    });
  };

  return (
    <details className="card stack">
      {dialog}
      <summary>Ajuster les présents ({present.length})</summary>
      <ul className="names attendance-edit">
        {present.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <button type="button" className="btn-secondary small" disabled={pending} onClick={() => remove(p)}>
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <label htmlFor={`add-${sessionId}`}>Ajouter un adhérent présent</label>
      <div className="action-row">
        <select id={`add-${sessionId}`} value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choisir…</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.answer === false ? " (avait dit non)" : ""}
            </option>
          ))}
        </select>
        <button type="button" className="btn-primary" disabled={pending || !selected} onClick={add}>
          Ajouter
        </button>
      </div>
      {error && <p className="error small" role="alert">{error}</p>}
    </details>
  );
}
